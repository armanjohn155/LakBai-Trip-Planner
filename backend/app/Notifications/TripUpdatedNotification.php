<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

class TripUpdatedNotification extends AppNotification
{
    public function __construct(
        public Itinerary $itinerary,
        public ?User $actor,
        public int $count = 1,
        public ?string $lastAction = null,
    ) {}

    public function type(): string
    {
        return NotificationType::TRIP_UPDATED;
    }

    public function message(): string
    {
        $subject = $this->actor?->name ? $this->actor->name : 'Someone';
        $changes = $this->count === 1 ? 'an update' : $this->count.' updates';

        return $subject.' made '.$changes.' to "'.$this->itinerary->title.'".';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips/'.$this->itinerary->id;
    }

    public function extraData(): array
    {
        return array_merge($this->itineraryPayload($this->itinerary), [
            'count' => $this->count,
            'last_action' => $this->lastAction,
            'actor' => $this->actorPayload($this->actor),
        ]);
    }
}
