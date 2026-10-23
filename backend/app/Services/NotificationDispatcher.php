<?php

namespace App\Services;

use App\Models\Itinerary;
use App\Models\User;
use App\Notifications\AppNotification;
use App\Notifications\TripUpdatedNotification;
use App\Support\NotificationType;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * Central place where notifications are addressed. Enforces the "never notify
 * the actor" and "never notify across a block" rules, and batches shared trip
 * updates so collaboration does not spam inboxes.
 */
class NotificationDispatcher
{
    public function __construct(
        private readonly FriendshipService $friends,
        private readonly NotificationPreferenceService $preferences,
    ) {}

    public function send(?User $recipient, AppNotification $notification, ?User $actor = null): void
    {
        if (! $recipient instanceof User || ! $this->isAllowed($recipient, $actor)) {
            return;
        }

        $recipient->notify($notification);
    }

    /**
     * @param  iterable<int, User>  $recipients
     */
    public function sendMany(iterable $recipients, AppNotification $notification, ?User $actor = null): void
    {
        foreach ($recipients as $recipient) {
            $this->send($recipient, $notification, $actor);
        }
    }

    /**
     * Owner plus accepted members, excluding the actor and blocked users.
     *
     * @return Collection<int, User>
     */
    public function tripRecipients(Itinerary $itinerary, ?User $actor = null): Collection
    {
        $owner = $itinerary->user;
        $members = $itinerary->acceptedMembers()->get();

        $recipients = collect($owner ? [$owner] : [])
            ->merge($members)
            ->filter(fn ($user) => $user instanceof User)
            ->unique('id')
            ->values();

        return new Collection(
            $recipients
                ->reject(fn (User $user) => $actor && $user->id === $actor->id)
                ->reject(fn (User $user) => $actor && $this->friends->isBlockedBetween($actor, $user))
                ->values()
                ->all()
        );
    }

    public function sendToTrip(Itinerary $itinerary, AppNotification $notification, ?User $actor = null): void
    {
        $this->sendMany($this->tripRecipients($itinerary, $actor), $notification, $actor);
    }

    /**
     * Batched trip.updated: one unread row per recipient per trip per window.
     */
    public function sendTripUpdated(Itinerary $itinerary, ?User $actor, string $action): void
    {
        $window = (int) config('lakbai.notifications.batch_window_minutes', 15);
        $since = now()->subMinutes($window);

        foreach ($this->tripRecipients($itinerary, $actor) as $recipient) {
            if (! $this->preferences->enabled($recipient, NotificationType::TRIP_UPDATED, 'in_app')) {
                continue;
            }

            $existing = $recipient->notifications()
                ->where('type', NotificationType::TRIP_UPDATED)
                ->whereNull('read_at')
                ->where('created_at', '>=', $since)
                ->get()
                ->first(fn ($notification) => (int) data_get($notification->data, 'itinerary_id') === (int) $itinerary->id);

            if ($existing instanceof \Illuminate\Notifications\DatabaseNotification) {
                $data = $existing->data;
                $count = (int) ($data['count'] ?? 1) + 1;
                $fresh = new TripUpdatedNotification($itinerary, $actor, $count, $action);

                $existing->forceFill([
                    'data' => array_merge($data, [
                        'count' => $count,
                        'message' => $fresh->message(),
                        'action_url' => $fresh->actionUrl(),
                        'last_action' => $action,
                        'actor' => $fresh->extraData()['actor'] ?? null,
                        'updated_at' => now()->toIso8601String(),
                    ]),
                    'updated_at' => now(),
                ])->save();

                continue;
            }

            Notification::sendNow($recipient, new TripUpdatedNotification($itinerary, $actor, 1, $action));
        }
    }

    /**
     * @param  iterable<int, User>  $recipients
     */
    public function sendToAdmins(AppNotification $notification, ?User $actor = null): void
    {
        User::query()
            ->where('role', 'admin')
            ->get()
            ->each(fn (User $admin) => $this->send($admin, $notification, $actor));
    }

    public function startingSoonAlreadySent(User $recipient, Itinerary $itinerary): bool
    {
        return $recipient->notifications()
            ->where('type', NotificationType::TRIP_STARTING_SOON)
            ->where('created_at', '>=', now()->startOfDay())
            ->get()
            ->contains(fn ($notification) => (int) data_get($notification->data, 'itinerary_id') === (int) $itinerary->id);
    }

    private function isAllowed(User $recipient, ?User $actor): bool
    {
        if ($actor && $recipient->id === $actor->id) {
            return false;
        }

        if ($actor && $this->friends->isBlockedBetween($actor, $recipient)) {
            return false;
        }

        return true;
    }
}
