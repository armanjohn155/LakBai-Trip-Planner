<?php

namespace App\Notifications;

use App\Models\User;
use App\Support\NotificationType;

class TripItineraryDeletedNotification extends AppNotification
{
    public function __construct(
        public int $itineraryId,
        public string $itineraryTitle,
        public ?User $actor = null,
    ) {}

    public function type(): string
    {
        return NotificationType::TRIP_ITINERARY_DELETED;
    }

    public function message(): string
    {
        $who = $this->actor?->name ? $this->actor->name.' deleted' : 'The owner deleted';

        return $who.' "'.$this->itineraryTitle.'".';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips';
    }

    public function extraData(): array
    {
        return [
            'itinerary_id' => $this->itineraryId,
            'itinerary_title' => $this->itineraryTitle,
            'actor' => $this->actorPayload($this->actor),
            'actionable' => false,
        ];
    }
}
