<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

/**
 * One batched in-app notice per trip telling the group that a sharing member
 * reached a stop. The actor is always excluded by NotificationDispatcher.
 */
class MemberArrivedNotification extends AppNotification
{
    public function __construct(
        public Itinerary $itinerary,
        public User $member,
        public int $itemId,
        public string $itemTitle,
    ) {}

    public function type(): string
    {
        return NotificationType::TRIP_MEMBER_ARRIVED;
    }

    public function message(): string
    {
        return "{$this->member->name} arrived at {$this->itemTitle}.";
    }

    public function actionUrl(): ?string
    {
        return "/app/trips/{$this->itinerary->id}";
    }

    /**
     * @return array<string, mixed>
     */
    public function extraData(): array
    {
        return [
            'itinerary_id' => (int) $this->itinerary->id,
            'itinerary_title' => (string) $this->itinerary->title,
            'member' => $this->actorPayload($this->member),
            'stop_id' => $this->itemId,
            'stop_title' => $this->itemTitle,
        ];
    }
}
