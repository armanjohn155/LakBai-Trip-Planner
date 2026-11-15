<?php

namespace App\Services;

use App\Events\MeetupPinned;
use App\Events\MemberArrived;
use App\Events\MemberLocationUpdated;
use App\Events\MemberPresenceChanged;
use App\Events\MemberSharingChanged;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\ItineraryMeetup;
use App\Models\TrackingSession;
use App\Models\User;
use App\Notifications\MemberArrivedNotification;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Group live tracking rules.
 *
 * Privacy invariants:
 *  - Sharing is opt-in per traveller and defaults to off. Nobody can enable
 *    it for somebody else.
 *  - Positions live in the cache for a short TTL, never as per-ping rows.
 *  - A member only receives other positions while they are sharing too.
 *  - Ending, pausing, cancelling or completing a trip clears the cache.
 */
class GroupTrackingService
{
    public function __construct(private readonly NotificationDispatcher $notifications) {}

    public function isGroup(Itinerary $itinerary): bool
    {
        return ($itinerary->trip_type ?? Itinerary::TRIP_SOLO) === Itinerary::TRIP_GROUP;
    }

    /**
     * Whether the user may currently read the private tracking channel.
     */
    public function isSharing(Itinerary $itinerary, User $user): bool
    {
        if (! $this->isGroup($itinerary)) {
            return false;
        }

        if (($itinerary->lifecycle_status ?? Itinerary::LIFECYCLE_PLANNED) !== Itinerary::LIFECYCLE_ACTIVE) {
            return false;
        }

        return TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->whereBelongsTo($user)
            ->active()
            ->shared()
            ->exists();
    }

    /**
     * Store the latest position, broadcast it at most once per interval and
     * flip presence to online on the first fresh ping.
     *
     * @param  array{lat: float, lng: float, accuracy_m?: int|null, recorded_at: string}  $position
     */
    public function recordMemberPosition(
        Itinerary $itinerary,
        User $member,
        TrackingSession $session,
        array $position,
        ?Carbon $now = null,
    ): void {
        if (! $this->isGroup($itinerary) || ! $session->shared_with_group) {
            return;
        }

        if (($itinerary->lifecycle_status ?? null) !== Itinerary::LIFECYCLE_ACTIVE) {
            return;
        }

        $now ??= Carbon::now();
        $ttl = (int) config('lakbai.tracking.group_position_ttl_seconds', 120);

        $payload = [
            'lat' => (float) $position['lat'],
            'lng' => (float) $position['lng'],
            'accuracy_m' => isset($position['accuracy_m']) ? (int) $position['accuracy_m'] : null,
            'recorded_at' => $position['recorded_at'],
        ];

        $this->cache()->put($this->positionKey($itinerary->id, $member->id), $payload, $ttl);

        if (! $this->cache()->get($this->presenceKey($itinerary->id, $member->id), false)) {
            $this->cache()->put($this->presenceKey($itinerary->id, $member->id), true, $ttl);
            MemberPresenceChanged::dispatch($itinerary, $member, true, $payload['recorded_at']);
        }

        $broadcastKey = $this->broadcastKey($itinerary->id, $member->id);

        if ($this->cache()->has($broadcastKey)) {
            return;
        }

        $this->cache()->put(
            $broadcastKey,
            true,
            max(1, (int) config('lakbai.tracking.group_broadcast_seconds', 5)),
        );

        MemberLocationUpdated::dispatch(
            $itinerary,
            $member,
            $payload['lat'],
            $payload['lng'],
            $payload['accuracy_m'],
            $payload['recorded_at'],
        );
    }

    /**
     * Everything the party panel and map need in one response.
     *
     * @return array<string, mixed>
     */
    public function state(Itinerary $itinerary, User $viewer, ?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $itinerary->loadMissing(['user', 'members']);

        $owner = $itinerary->user;
        $accepted = $itinerary->members
            ->filter(fn (User $member) => ($member->pivot->status ?? null) === Itinerary::STATUS_ACCEPTED);

        $people = (new Collection($owner ? [$owner] : []))
            ->merge($accepted)
            ->filter(fn ($person) => $person instanceof User)
            ->unique('id')
            ->values();

        $sessions = TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->active()
            ->shared()
            ->get()
            ->keyBy('user_id');

        $viewerSharing = ($itinerary->lifecycle_status ?? null) === Itinerary::LIFECYCLE_ACTIVE
            && $sessions->has($viewer->id);

        $onlineSeconds = max(1, (int) config('lakbai.tracking.group_online_seconds', 60));

        $members = $people->map(function (User $person) use ($itinerary, $sessions, $viewer, $viewerSharing, $now, $onlineSeconds) {
            $session = $sessions->get($person->id);
            $sharing = $session instanceof TrackingSession;
            $position = $sharing ? $this->cache()->get($this->positionKey($itinerary->id, $person->id)) : null;
            $position = is_array($position) ? $position : null;

            $online = $position !== null
                && $this->ageSeconds($position['recorded_at'] ?? null, $now) <= $onlineSeconds;

            $arrival = $this->cache()->get($this->arrivalKey($itinerary->id, $person->id));
            $arrival = is_array($arrival) ? $arrival : null;

            return [
                'user_id' => (int) $person->id,
                'name' => $person->name,
                'avatar_url' => $person->avatar_url,
                'role' => $itinerary->roleFor($person),
                'is_me' => (int) $person->id === (int) $viewer->id,
                'sharing' => $sharing,
                'online' => $viewerSharing ? $online : null,
                'last_seen_at' => $viewerSharing && $position !== null ? $position['recorded_at'] : null,
                'position' => $viewerSharing ? $position : null,
                'arrived_stop' => $viewerSharing && $arrival !== null ? [
                    'id' => (int) ($arrival['item_id'] ?? 0),
                    'title' => (string) ($arrival['title'] ?? ''),
                    'at' => $arrival['at'] ?? null,
                ] : null,
            ];
        })->values();

        $self = $members->firstWhere('user_id', (int) $viewer->id);
        $selfSession = $sessions->get($viewer->id);
        $selfPosition = is_array($self) ? ($self['position'] ?? null) : null;

        if ($selfPosition === null && $selfSession instanceof TrackingSession && $selfSession->last_lat !== null && $selfSession->last_lng !== null) {
            $selfPosition = [
                'lat' => (float) $selfSession->last_lat,
                'lng' => (float) $selfSession->last_lng,
                'accuracy_m' => $selfSession->last_accuracy_m,
                'recorded_at' => $selfSession->last_point_at?->toIso8601String(),
            ];
        }

        $meetup = $this->activeMeetup($itinerary, $now);

        return [
            'itinerary_id' => (int) $itinerary->id,
            'lifecycle_status' => $itinerary->lifecycle_status ?? Itinerary::LIFECYCLE_PLANNED,
            'group' => true,
            'poll_seconds' => max(1, (int) config('lakbai.tracking.group_poll_seconds', 10)),
            'me' => [
                'user_id' => (int) $viewer->id,
                'role' => $itinerary->roleFor($viewer),
                'sharing' => $viewerSharing,
                'online' => is_array($self) ? ($self['online'] ?? false) : false,
                'position' => $selfPosition,
            ],
            'members' => $members,
            'meetup' => $meetup !== null ? $this->meetupPayload($meetup) : null,
        ];
    }

    /**
     * Enable or disable group sharing for one traveller.
     *
     * @return array<string, mixed>
     */
    public function setSharing(Itinerary $itinerary, User $actor, bool $enabled, ?Carbon $now = null): array
    {
        if (! $this->isGroup($itinerary)) {
            abort(422, 'Group tracking is only available for group trips.');
        }

        if ($itinerary->roleFor($actor) === null) {
            abort(404);
        }

        $now ??= Carbon::now();
        $wasSharing = $this->isSharing($itinerary, $actor);

        if ($enabled) {
            if (($itinerary->lifecycle_status ?? null) !== Itinerary::LIFECYCLE_ACTIVE) {
                abort(409, 'Sharing is only available while the trip is active.');
            }

            $session = TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->whereBelongsTo($actor)
                ->whereIn('status', [TrackingSession::STATUS_ACTIVE, TrackingSession::STATUS_PAUSED])
                ->latest('started_at')
                ->first();

            if ($session === null) {
                TrackingSession::query()->create([
                    'itinerary_id' => $itinerary->id,
                    'user_id' => $actor->id,
                    'status' => TrackingSession::STATUS_ACTIVE,
                    'shared_with_group' => true,
                    'started_at' => $now,
                    'distance_m' => 0,
                ]);
            } else {
                $session->forceFill([
                    'status' => TrackingSession::STATUS_ACTIVE,
                    'shared_with_group' => true,
                    'ended_at' => null,
                ])->save();
            }

            MemberSharingChanged::dispatch($itinerary, $actor, true, 'started');
        } else {
            TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->whereBelongsTo($actor)
                ->where('shared_with_group', true)
                ->update(['shared_with_group' => false]);

            $this->forgetPosition($itinerary->id, $actor->id);

            if ($wasSharing) {
                MemberSharingChanged::dispatch($itinerary, $actor, false, 'stopped');
            }
        }

        return $this->state($itinerary->refresh(), $actor, $now);
    }

    /**
     * Drop a temporary meeting pin. Any accepted member may set one; a new
     * pin replaces the previous one for the trip.
     */
    public function pinMeetup(
        Itinerary $itinerary,
        User $actor,
        float $lat,
        float $lng,
        ?string $note = null,
        ?Carbon $now = null,
    ): ItineraryMeetup {
        if (! $this->isGroup($itinerary)) {
            abort(422, 'Meeting pins are only available for group trips.');
        }

        if ($itinerary->roleFor($actor) === null) {
            abort(404);
        }

        if (($itinerary->lifecycle_status ?? null) !== Itinerary::LIFECYCLE_ACTIVE) {
            abort(409, 'Meeting pins are only available while the trip is active.');
        }

        $now ??= Carbon::now();

        ItineraryMeetup::query()->where('itinerary_id', $itinerary->id)->delete();

        $meetup = ItineraryMeetup::query()->create([
            'itinerary_id' => $itinerary->id,
            'created_by' => $actor->id,
            'latitude' => $lat,
            'longitude' => $lng,
            'note' => $note,
            'expires_at' => $now->copy()->addMinutes(max(1, (int) config('lakbai.tracking.meetup_ttl_minutes', 120))),
        ]);

        $meetup->loadMissing('creator');
        MeetupPinned::dispatch($itinerary, $meetup);

        return $meetup;
    }

    /**
     * Broadcast and (optionally) notify that a sharing member reached a stop.
     * The event is deduplicated per member and stop.
     */
    public function memberArrived(Itinerary $itinerary, ItineraryItem $item, User $member, ?Carbon $now = null): void
    {
        if (! $this->isGroup($itinerary)) {
            return;
        }

        if (($itinerary->lifecycle_status ?? null) !== Itinerary::LIFECYCLE_ACTIVE) {
            return;
        }

        if (! $this->isSharing($itinerary, $member)) {
            return;
        }

        $now ??= Carbon::now();
        $dedupeKey = $this->arrivalKey($itinerary->id, $member->id).'.'.$item->id;

        if (! $this->cache()->add($dedupeKey, true, 86_400)) {
            return;
        }

        $this->cache()->put($this->arrivalKey($itinerary->id, $member->id), [
            'item_id' => (int) $item->id,
            'title' => $item->resolvedTitle(),
            'at' => $now->toIso8601String(),
        ], 86_400);

        MemberArrived::dispatch(
            $itinerary,
            $member,
            (int) $item->id,
            $item->resolvedTitle(),
            $now->toIso8601String(),
        );

        if (! (bool) config('lakbai.tracking.group_arrival_notify', true)) {
            return;
        }

        $window = max(1, (int) config('lakbai.tracking.group_arrival_notify_minutes', 30));

        if (! $this->cache()->add($this->arrivalNotifyKey($itinerary->id), true, $window * 60)) {
            return;
        }

        $this->notifications->sendToTrip(
            $itinerary,
            new MemberArrivedNotification($itinerary, $member, (int) $item->id, $item->resolvedTitle()),
            $member,
        );
    }

    /**
     * Stop everyone's sharing and clear cached positions. Called when a trip is
     * paused, finished, cancelled or auto-expired.
     */
    public function stopAllSharing(Itinerary $itinerary, string $reason): void
    {
        $sessions = TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->where('shared_with_group', true)
            ->with('user')
            ->get();

        foreach ($sessions as $session) {
            $session->forceFill(['shared_with_group' => false])->save();
            $this->forgetPosition($itinerary->id, (int) $session->user_id);

            if ($session->user instanceof User) {
                MemberSharingChanged::dispatch($itinerary, $session->user, false, $reason);
            }
        }

        ItineraryMeetup::query()->where('itinerary_id', $itinerary->id)->delete();
    }

    /**
     * Clear cached data without broadcasting, for scheduled cleanup paths.
     */
    public function forgetTrip(Itinerary $itinerary): void
    {
        TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->where('shared_with_group', true)
            ->update(['shared_with_group' => false]);

        ItineraryMeetup::query()->where('itinerary_id', $itinerary->id)->delete();
    }

    /**
     * Emit offline events for sharing members whose last ping is too old.
     */
    public function syncPresence(Itinerary $itinerary, ?Carbon $now = null): void
    {
        if (! $this->isGroup($itinerary)) {
            return;
        }

        $now ??= Carbon::now();
        $onlineSeconds = max(1, (int) config('lakbai.tracking.group_online_seconds', 60));

        $sessions = TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->active()
            ->shared()
            ->with('user')
            ->get();

        foreach ($sessions as $session) {
            if (! $session->user instanceof User) {
                continue;
            }

            $position = $this->cache()->get($this->positionKey($itinerary->id, (int) $session->user_id));
            $position = is_array($position) ? $position : null;
            $online = $position !== null
                && $this->ageSeconds($position['recorded_at'] ?? null, $now) <= $onlineSeconds;
            $flagged = (bool) $this->cache()->get($this->presenceKey($itinerary->id, (int) $session->user_id), false);

            if ($online && ! $flagged) {
                $this->cache()->put($this->presenceKey($itinerary->id, (int) $session->user_id), true, $onlineSeconds * 2);
                MemberPresenceChanged::dispatch($itinerary, $session->user, true, $position['recorded_at'] ?? null);
            } elseif (! $online && $flagged) {
                $this->cache()->forget($this->presenceKey($itinerary->id, (int) $session->user_id));
                MemberPresenceChanged::dispatch($itinerary, $session->user, false, $position['recorded_at'] ?? null);
            }
        }
    }

    /**
     * Run the presence sweep for every active group trip that still has
     * members sharing. Returns the number of trips inspected.
     */
    public function sweepPresence(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $trips = 0;

        Itinerary::query()
            ->where('trip_type', Itinerary::TRIP_GROUP)
            ->where('lifecycle_status', Itinerary::LIFECYCLE_ACTIVE)
            ->whereHas('trackingSessions', fn ($query) => $query->active()->shared())
            ->chunkById(100, function ($itineraries) use ($now, &$trips) {
                foreach ($itineraries as $itinerary) {
                    $this->syncPresence($itinerary, $now);
                    $trips++;
                }
            });

        return $trips;
    }

    /**
     * Auto-stop sharing for sessions without a ping in the configured window,
     * and prune expired meeting pins.
     */
    public function stopStaleSharing(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $cutoff = $now->copy()->subHours(max(1, (int) config('lakbai.tracking.group_stale_sharing_hours', 12)));
        $stopped = 0;

        TrackingSession::query()
            ->where('shared_with_group', true)
            ->whereIn('status', [TrackingSession::STATUS_ACTIVE, TrackingSession::STATUS_PAUSED])
            ->with(['itinerary', 'user'])
            ->chunkById(100, function ($sessions) use ($cutoff, &$stopped) {
                foreach ($sessions as $session) {
                    $lastPing = $session->last_point_at ?? $session->started_at;

                    if ($lastPing !== null && $lastPing->gt($cutoff)) {
                        continue;
                    }

                    $session->forceFill(['shared_with_group' => false])->save();

                    if ($session->itinerary instanceof Itinerary) {
                        $this->forgetPosition((int) $session->itinerary_id, (int) $session->user_id);

                        if ($session->user instanceof User) {
                            MemberSharingChanged::dispatch($session->itinerary, $session->user, false, 'stale');
                        }
                    }

                    $stopped++;
                }
            });

        ItineraryMeetup::query()->where('expires_at', '<=', $now)->delete();

        return $stopped;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function meetupPayload(?ItineraryMeetup $meetup): ?array
    {
        if ($meetup === null) {
            return null;
        }

        $meetup->loadMissing('creator');

        return [
            'id' => (int) $meetup->id,
            'lat' => (float) $meetup->latitude,
            'lng' => (float) $meetup->longitude,
            'note' => $meetup->note,
            'created_by' => (int) $meetup->created_by,
            'created_by_name' => $meetup->creator?->name,
            'expires_at' => $meetup->expires_at?->toIso8601String(),
        ];
    }

    private function activeMeetup(Itinerary $itinerary, Carbon $now): ?ItineraryMeetup
    {
        return ItineraryMeetup::query()
            ->where('itinerary_id', $itinerary->id)
            ->where('expires_at', '>', $now)
            ->with('creator')
            ->latest('id')
            ->first();
    }

    private function forgetPosition(int $itineraryId, int $userId): void
    {
        $this->cache()->forget($this->positionKey($itineraryId, $userId));
        $this->cache()->forget($this->presenceKey($itineraryId, $userId));
        $this->cache()->forget($this->broadcastKey($itineraryId, $userId));
        $this->cache()->forget($this->arrivalKey($itineraryId, $userId));
    }

    private function ageSeconds(?string $recordedAt, Carbon $now): int
    {
        if ($recordedAt === null) {
            return PHP_INT_MAX;
        }

        try {
            return max(0, $now->getTimestamp() - Carbon::parse($recordedAt)->getTimestamp());
        } catch (\Throwable) {
            return PHP_INT_MAX;
        }
    }

    private function positionKey(int $itineraryId, int $userId): string
    {
        return "lakbai.tracking.group.{$itineraryId}.position.{$userId}";
    }

    private function presenceKey(int $itineraryId, int $userId): string
    {
        return "lakbai.tracking.group.{$itineraryId}.presence.{$userId}";
    }

    private function broadcastKey(int $itineraryId, int $userId): string
    {
        return "lakbai.tracking.group.{$itineraryId}.broadcast.{$userId}";
    }

    private function arrivalKey(int $itineraryId, int $userId): string
    {
        return "lakbai.tracking.group.{$itineraryId}.arrival.{$userId}";
    }

    private function arrivalNotifyKey(int $itineraryId): string
    {
        return "lakbai.tracking.group.{$itineraryId}.arrival.notify";
    }

    private function cache(): CacheRepository
    {
        $store = config('lakbai.tracking.group_cache_store');

        return Cache::store(is_string($store) && $store !== '' ? $store : null);
    }
}
