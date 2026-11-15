<?php

namespace App\Services;

use App\Events\StopArrived;
use App\Events\StopCompleted;
use App\Events\StopSkipped;
use App\Events\TripCompleted;
use App\Events\TripPaused;
use App\Events\TripRescheduled;
use App\Events\TripResumed;
use App\Events\TripStarted;
use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\Review;
use App\Models\TrackingSession;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * All trip lifecycle rules live here so controllers stay thin and future
 * clients (mobile, group trips) cannot invent their own transitions.
 *
 * planned -> active -> paused <-> active -> completed
 *      \-> cancelled        \-> cancelled
 */
class TripLifecycleService
{
    public const TRANSITIONS = [
        Itinerary::LIFECYCLE_PLANNED => [Itinerary::LIFECYCLE_ACTIVE, Itinerary::LIFECYCLE_CANCELLED],
        Itinerary::LIFECYCLE_ACTIVE => [Itinerary::LIFECYCLE_PAUSED, Itinerary::LIFECYCLE_COMPLETED, Itinerary::LIFECYCLE_CANCELLED],
        Itinerary::LIFECYCLE_PAUSED => [Itinerary::LIFECYCLE_ACTIVE, Itinerary::LIFECYCLE_COMPLETED, Itinerary::LIFECYCLE_CANCELLED],
        Itinerary::LIFECYCLE_COMPLETED => [],
        Itinerary::LIFECYCLE_CANCELLED => [],
    ];

    public function __construct(
        private readonly ItineraryActivityLogger $activity,
        private readonly CheckInVerifier $verifier,
        private readonly GroupTrackingService $group,
    ) {}

    /**
     * Start a planned trip and open the user's tracking session.
     */
    public function start(Itinerary $itinerary, User $actor): Itinerary
    {
        $this->assertEditable($itinerary, $actor);

        if (($itinerary->lifecycle_status ?? Itinerary::LIFECYCLE_PLANNED) !== Itinerary::LIFECYCLE_PLANNED) {
            if ($itinerary->lifecycle_status === Itinerary::LIFECYCLE_ACTIVE) {
                $existing = $this->activeSession($itinerary, $actor);

                if ($existing !== null) {
                    return $itinerary;
                }
            }

            $this->fail(409, 'This trip cannot be started from its current state.');
        }

        if ($itinerary->items()->count() === 0) {
            $this->fail(422, 'Add at least one stop before starting the trip.');
        }

        $other = Itinerary::query()
            ->where('user_id', $actor->id)
            ->whereKeyNot($itinerary->id)
            ->whereIn('lifecycle_status', [Itinerary::LIFECYCLE_ACTIVE, Itinerary::LIFECYCLE_PAUSED])
            ->first();

        if ($other !== null) {
            $this->fail(409, "You already have an ongoing trip: {$other->title}. Finish or cancel it first.");
        }

        $now = Carbon::now();

        DB::transaction(function () use ($itinerary, $actor, $now) {
            // Abandoned sessions from an earlier attempt must not overlap.
            TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->whereBelongsTo($actor)
                ->whereIn('status', [TrackingSession::STATUS_ACTIVE, TrackingSession::STATUS_PAUSED])
                ->update(['status' => TrackingSession::STATUS_ENDED, 'ended_at' => $now]);

            $itinerary->forceFill([
                'lifecycle_status' => Itinerary::LIFECYCLE_ACTIVE,
                'started_at' => $now,
                'paused_at' => null,
                'completed_at' => null,
                'total_paused_seconds' => 0,
                'distance_m' => 0,
                'moving_seconds' => 0,
                'started_by' => $actor->id,
            ]);

            TrackingSession::query()->create([
                'itinerary_id' => $itinerary->id,
                'user_id' => $actor->id,
                'status' => TrackingSession::STATUS_ACTIVE,
                'started_at' => $now,
                'distance_m' => 0,
            ]);

            $this->activity->recordChange($itinerary, 'trip.started', $actor, null, [
                'stop_count' => $itinerary->items()->count(),
            ]);
        });

        TripStarted::dispatch($itinerary, $actor);

        return $itinerary->refresh();
    }

    /**
     * Pause an active trip. Tracking stops until the user resumes.
     */
    public function pause(Itinerary $itinerary, User $actor): Itinerary
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertTransition($itinerary, Itinerary::LIFECYCLE_PAUSED);

        $now = Carbon::now();

        DB::transaction(function () use ($itinerary, $actor, $now) {
            /*
             * A paused trip pauses every traveller's session, not just the one
             * who pressed the button, so the party list reports "paused" for
             * the whole group instead of showing stale "active" rows.
             */
            TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->where('status', TrackingSession::STATUS_ACTIVE)
                ->update(['status' => TrackingSession::STATUS_PAUSED]);

            $itinerary->forceFill([
                'lifecycle_status' => Itinerary::LIFECYCLE_PAUSED,
                'paused_at' => $now,
            ]);

            $this->activity->recordChange($itinerary, 'trip.paused', $actor);
        });

        TripPaused::dispatch($itinerary, $actor);

        $itinerary->refresh();

        // Pausing is privacy-first: nobody keeps sharing while the trip is not
        // active. Members must opt in again after a resume.
        if ($this->group->isGroup($itinerary)) {
            $this->group->stopAllSharing($itinerary, 'paused');
        }

        return $itinerary;
    }

    /**
     * Resume a paused trip and accumulate the paused duration.
     */
    public function resume(Itinerary $itinerary, User $actor): Itinerary
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertTransition($itinerary, Itinerary::LIFECYCLE_ACTIVE);

        $now = Carbon::now();
        $pausedFor = $itinerary->paused_at !== null
            ? max(0, (int) $itinerary->paused_at->diffInSeconds($now))
            : 0;

        DB::transaction(function () use ($itinerary, $actor, $pausedFor) {
            TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->where('status', TrackingSession::STATUS_PAUSED)
                ->update(['status' => TrackingSession::STATUS_ACTIVE]);

            $itinerary->forceFill([
                'lifecycle_status' => Itinerary::LIFECYCLE_ACTIVE,
                'paused_at' => null,
                'total_paused_seconds' => (int) $itinerary->total_paused_seconds + $pausedFor,
            ]);

            $this->activity->recordChange($itinerary, 'trip.resumed', $actor, null, [
                'paused_seconds' => $pausedFor,
            ]);
        });

        TripResumed::dispatch($itinerary, $actor);

        return $itinerary->refresh();
    }

    /**
     * Finish an active or paused trip. Unvisited stops become skipped.
     *
     * @return array{itinerary: Itinerary, skipped: int}
     */
    public function finish(Itinerary $itinerary, User $actor): array
    {
        $this->assertEditable($itinerary, $actor);

        if (! in_array($itinerary->lifecycle_status, [Itinerary::LIFECYCLE_ACTIVE, Itinerary::LIFECYCLE_PAUSED], true)) {
            $this->fail(409, 'Only an active or paused trip can be finished.');
        }

        $now = Carbon::now();
        $skipped = 0;

        DB::transaction(function () use ($itinerary, $actor, $now, &$skipped) {
            $remaining = $itinerary->items()
                ->whereIn('status', ['planned', 'arrived'])
                ->get();

            $skipped = $remaining->count();

            foreach ($remaining as $item) {
                $item->forceFill([
                    'status' => 'skipped',
                    'completed_at' => $now,
                    'updated_by' => $actor->id,
                ])->save();
            }

            TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->whereIn('status', [TrackingSession::STATUS_ACTIVE, TrackingSession::STATUS_PAUSED])
                ->update(['status' => TrackingSession::STATUS_ENDED, 'ended_at' => $now]);

            $itinerary->forceFill([
                'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
                'completed_at' => $now,
                'paused_at' => null,
            ]);

            $this->activity->recordChange($itinerary, 'trip.completed', $actor, null, [
                'skipped_stops' => $skipped,
            ]);
        });

        TripCompleted::dispatch($itinerary, $actor, ['skipped_stops' => $skipped]);

        $itinerary->refresh();

        if ($this->group->isGroup($itinerary)) {
            $this->group->stopAllSharing($itinerary, 'completed');
        }

        return ['itinerary' => $itinerary, 'skipped' => $skipped];
    }

    /**
     * Cancel a planned, active or paused trip.
     */
    public function cancel(Itinerary $itinerary, User $actor): Itinerary
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertTransition($itinerary, Itinerary::LIFECYCLE_CANCELLED);

        $now = Carbon::now();

        DB::transaction(function () use ($itinerary, $actor, $now) {
            $itinerary->items()
                ->whereIn('status', ['planned', 'arrived'])
                ->update(['status' => 'skipped', 'completed_at' => $now, 'updated_by' => $actor->id]);

            TrackingSession::query()
                ->whereBelongsTo($itinerary)
                ->whereIn('status', [TrackingSession::STATUS_ACTIVE, TrackingSession::STATUS_PAUSED])
                ->update(['status' => TrackingSession::STATUS_ENDED, 'ended_at' => $now]);

            $itinerary->forceFill([
                'lifecycle_status' => Itinerary::LIFECYCLE_CANCELLED,
                'paused_at' => null,
            ]);

            $this->activity->recordChange($itinerary, 'trip.cancelled', $actor);
        });

        $itinerary->refresh();

        if ($this->group->isGroup($itinerary)) {
            $this->group->stopAllSharing($itinerary, 'cancelled');
        }

        return $itinerary;
    }

    /**
     * Move or shift the remaining planned stops without touching completed
     * ones. Runs inside one transaction and bumps the itinerary version once.
     */
    public function reschedule(Itinerary $itinerary, User $actor, string $strategy, array $options = []): Itinerary
    {
        $this->assertEditable($itinerary, $actor);

        if (in_array($itinerary->lifecycle_status, [Itinerary::LIFECYCLE_COMPLETED, Itinerary::LIFECYCLE_CANCELLED], true)) {
            $this->fail(409, 'A finished trip cannot be rescheduled.');
        }

        $remaining = $itinerary->items()
            ->whereIn('status', ['planned', 'arrived'])
            ->get();

        if ($remaining->isEmpty()) {
            $this->fail(422, 'There are no remaining stops to reschedule.');
        }

        DB::transaction(function () use ($itinerary, $actor, $strategy, $options, $remaining) {
            if ($strategy === 'shift') {
                $minutes = (int) ($options['minutes'] ?? 0);

                foreach ($remaining as $item) {
                    if ($item->start_time === null) {
                        continue;
                    }

                    $start = Carbon::createFromFormat('H:i', substr((string) $item->start_time, 0, 5));
                    $item->forceFill([
                        'start_time' => $start->addMinutes($minutes)->format('H:i'),
                        'updated_by' => $actor->id,
                    ])->save();
                }
            } else {
                $targetDay = (int) $options['day_number'];
                $nextOrder = ((int) $itinerary->items()
                    ->where('day_number', $targetDay)
                    ->whereNotIn('id', $remaining->pluck('id')->all())
                    ->max('order')) + 1;

                foreach ($remaining->sortBy([['day_number', 'asc'], ['order', 'asc']]) as $item) {
                    $item->forceFill([
                        'day_number' => $targetDay,
                        'order' => $nextOrder,
                        'updated_by' => $actor->id,
                    ])->save();
                    $nextOrder++;
                }
            }

            $this->activity->recordChange($itinerary, 'trip.rescheduled', $actor, null, [
                'strategy' => $strategy,
                'moved_stops' => $remaining->count(),
                ...$options,
            ]);
        });

        TripRescheduled::dispatch($itinerary, $actor, ['strategy' => $strategy, ...$options]);

        return $itinerary->refresh();
    }

    /**
     * Record that the traveller reached a stop. No visit is created yet.
     */
    public function arrive(Itinerary $itinerary, ItineraryItem $item, User $actor): ItineraryItem
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertOngoing($itinerary);

        if ($item->status === 'done' || $item->status === 'skipped') {
            $this->fail(422, 'This stop is already completed.');
        }

        if ($item->status === 'arrived') {
            return $item;
        }

        DB::transaction(function () use ($itinerary, $item, $actor) {
            $item->forceFill([
                'status' => 'arrived',
                'arrived_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $this->activity->recordChange($itinerary, 'stop.arrived', $actor, $item, [
                'item_id' => $item->id,
            ]);
        });

        StopArrived::dispatch($itinerary, $actor, ['item_id' => $item->id]);

        $this->group->memberArrived($itinerary, $item, $actor);

        return $item->refresh();
    }

    /**
     * Complete a stop through the existing verified check-in service.
     *
     * @param  array{latitude: float, longitude: float, accuracy: float}  $position
     * @return array{ok: bool, item?: ItineraryItem, visit?: Visit, can_review?: bool, distance_m?: int, radius_m?: int, status?: int, message?: string, reason?: string}
     */
    public function complete(Itinerary $itinerary, ItineraryItem $item, User $actor, array $position): array
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertOngoing($itinerary);

        if ($itinerary->lifecycle_status === Itinerary::LIFECYCLE_PAUSED) {
            $this->fail(409, 'Resume the trip before marking a stop visited.');
        }

        if ($this->activeSession($itinerary, $actor) === null) {
            $this->fail(409, 'Start tracking before marking a stop visited.');
        }

        if ($item->status === 'done') {
            return [
                'ok' => true,
                'item' => $item,
                'visit' => $item->visit,
                'can_review' => $this->canReview($item, $actor),
                'distance_m' => $item->visit?->distance_m,
                'radius_m' => null,
            ];
        }

        if (! in_array($item->status, ['planned', 'arrived'], true)) {
            $this->fail(422, 'This stop cannot be completed.');
        }

        $destination = $item->destination_id !== null
            ? $item->destination()->withTrashed()->first()
            : null;

        $visit = null;
        $distance = 0;
        $radius = (int) config('lakbai.tracking.arrival_radius_m', 150);

        if ($destination instanceof Destination) {
            if ($destination->trashed()) {
                $this->fail(422, 'This destination is no longer available for check-ins.');
            }

            $result = $this->verifier->verify($actor, $destination, $position);
            $distance = $result->distanceM;
            $radius = $result->radiusM;

            if (! $result->ok) {
                return [
                    'ok' => false,
                    'status' => $result->reason === 'cooldown' ? 429 : 422,
                    'message' => $result->message,
                    'reason' => $result->reason,
                    'distance_m' => $result->distanceM,
                    'radius_m' => $result->radiusM,
                ];
            }
        } else {
            // Custom stops have no destination/visit row, but still require a
            // server-side proximity and accuracy check.
            $coords = $item->resolvedCoordinates();

            if ($coords === null) {
                $this->fail(422, 'This custom stop has no coordinates to verify against.');
            }

            $distance = (int) round($this->verifier->haversineMeters(
                $coords[0],
                $coords[1],
                $position['latitude'],
                $position['longitude'],
            ));

            if ((int) round($position['accuracy']) > (int) config('lakbai.tracking.max_accuracy_m', 100)) {
                return [
                    'ok' => false,
                    'status' => 422,
                    'message' => 'Your GPS signal is too weak to verify this stop. Step outside and try again.',
                    'reason' => 'accuracy',
                    'distance_m' => $distance,
                    'radius_m' => $radius,
                ];
            }

            if ($distance > $radius) {
                return [
                    'ok' => false,
                    'status' => 422,
                    'message' => "You are {$distance} m away - move within {$radius} m of {$item->resolvedTitle()} to complete it.",
                    'reason' => 'distance',
                    'distance_m' => $distance,
                    'radius_m' => $radius,
                ];
            }
        }

        $now = Carbon::now();

        DB::transaction(function () use ($itinerary, $item, $actor, $position, $destination, &$visit, $now, $distance) {
            if ($destination instanceof Destination) {
                $visit = Visit::query()->create([
                    'user_id' => $actor->id,
                    'destination_id' => $destination->id,
                    'itinerary_stop_id' => $item->id,
                    'verified' => true,
                    'method' => 'gps',
                    'latitude' => $position['latitude'],
                    'longitude' => $position['longitude'],
                    'distance_m' => $distance,
                    'accuracy_m' => (int) round($position['accuracy']),
                    'visited_at' => $now,
                ]);
            }

            $item->forceFill([
                'status' => 'done',
                'visited' => true,
                'arrived_at' => $item->arrived_at ?? $now,
                'completed_at' => $now,
                'visit_id' => $visit?->id,
                'updated_by' => $actor->id,
            ])->save();

            $this->activity->recordChange($itinerary, 'stop.completed', $actor, $item, [
                'item_id' => $item->id,
                'visit_id' => $visit?->id,
            ]);
        });

        StopCompleted::dispatch($itinerary, $actor, [
            'item_id' => $item->id,
            'visit_id' => $visit?->id,
        ]);

        if ($this->group->isGroup($itinerary)) {
            $this->group->memberArrived($itinerary, $item, $actor, $now);
        }

        return [
            'ok' => true,
            'item' => $item->refresh(),
            'visit' => $visit,
            'can_review' => $this->canReview($item, $actor),
            'distance_m' => $distance,
            'radius_m' => $radius,
        ];
    }

    /**
     * Skip a stop the traveller does not want to visit.
     */
    public function skip(Itinerary $itinerary, ItineraryItem $item, User $actor): ItineraryItem
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertOngoing($itinerary);

        if ($item->status === 'done') {
            $this->fail(422, 'A visited stop cannot be skipped. Undo it first.');
        }

        if ($item->status === 'skipped') {
            return $item;
        }

        DB::transaction(function () use ($itinerary, $item, $actor) {
            $item->forceFill([
                'status' => 'skipped',
                'completed_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $this->activity->recordChange($itinerary, 'stop.skipped', $actor, $item, [
                'item_id' => $item->id,
            ]);
        });

        StopSkipped::dispatch($itinerary, $actor, ['item_id' => $item->id]);

        return $item->refresh();
    }

    /**
     * Undo a completion (or skip) within the configured window. A GPS visit
     * created by this stop is removed so the check-in history does not keep a
     * record the traveller explicitly corrected.
     */
    public function undo(Itinerary $itinerary, ItineraryItem $item, User $actor): ItineraryItem
    {
        $this->assertEditable($itinerary, $actor);
        $this->assertOngoing($itinerary);

        $minutes = (int) config('lakbai.tracking.undo_minutes', 10);

        if ($item->completed_at === null) {
            $this->fail(422, 'This stop has not been completed yet.');
        }

        if ($item->completed_at->diffInMinutes(Carbon::now()) > $minutes) {
            $this->fail(422, 'The undo window for this stop has closed.');
        }

        $visitId = $item->visit_id;

        DB::transaction(function () use ($itinerary, $item, $actor, $visitId) {
            if ($visitId !== null) {
                Visit::query()
                    ->whereKey($visitId)
                    ->where('user_id', $actor->id)
                    ->where('itinerary_stop_id', $item->id)
                    ->delete();
            }

            $item->forceFill([
                'status' => 'planned',
                'visited' => false,
                'arrived_at' => null,
                'completed_at' => null,
                'visit_id' => null,
                'updated_by' => $actor->id,
            ])->save();

            $this->activity->recordChange($itinerary, 'stop.undone', $actor, $item, [
                'item_id' => $item->id,
            ]);
        });

        return $item->refresh();
    }

    /**
     * Schedule-time expiry used by the trips:expire-stale command.
     *
     * @return array{paused: int, cancelled: int}
     */
    public function expireStale(?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $activeCutoff = $now->copy()->subHours((int) config('lakbai.tracking.stale_active_hours', 24));
        $pausedCutoff = $now->copy()->subDays((int) config('lakbai.tracking.stale_paused_days', 7));

        $paused = 0;
        $cancelled = 0;

        Itinerary::query()
            ->where('lifecycle_status', Itinerary::LIFECYCLE_ACTIVE)
            ->whereDoesntHave('trackingSessions', fn ($query) => $query->where('last_point_at', '>=', $activeCutoff))
            ->where('started_at', '<=', $activeCutoff)
            ->chunkById(100, function ($trips) use ($now, &$paused) {
                foreach ($trips as $trip) {
                    TrackingSession::query()
                        ->whereBelongsTo($trip)
                        ->where('status', TrackingSession::STATUS_ACTIVE)
                        ->update(['status' => TrackingSession::STATUS_PAUSED]);

                    $trip->forceFill([
                        'lifecycle_status' => Itinerary::LIFECYCLE_PAUSED,
                        'paused_at' => $now,
                    ])->saveQuietly();

                    if ($this->group->isGroup($trip)) {
                        $this->group->stopAllSharing($trip, 'expired');
                    }

                    $paused++;
                }
            });

        Itinerary::query()
            ->where('lifecycle_status', Itinerary::LIFECYCLE_PAUSED)
            ->where('paused_at', '<=', $pausedCutoff)
            ->chunkById(100, function ($trips) use ($now, &$cancelled) {
                foreach ($trips as $trip) {
                    TrackingSession::query()
                        ->whereBelongsTo($trip)
                        ->whereIn('status', [TrackingSession::STATUS_ACTIVE, TrackingSession::STATUS_PAUSED])
                        ->update(['status' => TrackingSession::STATUS_ENDED, 'ended_at' => $now]);

                    $trip->forceFill([
                        'lifecycle_status' => Itinerary::LIFECYCLE_CANCELLED,
                        'paused_at' => null,
                    ])->saveQuietly();

                    if ($this->group->isGroup($trip)) {
                        $this->group->stopAllSharing($trip, 'expired');
                    }

                    $cancelled++;
                }
            });

        return ['paused' => $paused, 'cancelled' => $cancelled];
    }

    public function canReview(ItineraryItem $item, User $user): bool
    {
        if ($item->destination_id === null) {
            return false;
        }

        return ! Review::query()
            ->where('user_id', $user->id)
            ->where('destination_id', $item->destination_id)
            ->exists();
    }

    private function activeSession(Itinerary $itinerary, User $actor): ?TrackingSession
    {
        return TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->whereBelongsTo($actor)
            ->where('status', TrackingSession::STATUS_ACTIVE)
            ->latest('started_at')
            ->first();
    }

    private function assertEditable(Itinerary $itinerary, User $actor): void
    {
        if (! $itinerary->isEditableBy($actor)) {
            abort(403, 'You do not have permission to change this trip.');
        }
    }

    private function assertOngoing(Itinerary $itinerary): void
    {
        if (! $itinerary->isOngoing()) {
            $this->fail(409, 'This trip is not ongoing.');
        }
    }

    private function assertTransition(Itinerary $itinerary, string $target): void
    {
        $from = $itinerary->lifecycle_status ?? Itinerary::LIFECYCLE_PLANNED;

        if (! in_array($target, self::TRANSITIONS[$from] ?? [], true)) {
            $this->fail(409, "A {$from} trip cannot become {$target}.");
        }
    }

    private function fail(int $status, string $message): never
    {
        abort($status, $message);
    }
}
