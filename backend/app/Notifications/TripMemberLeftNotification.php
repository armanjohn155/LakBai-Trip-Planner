<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

class TripMemberLeftNotification extends AppNotification
{
    public function __construct(public Itinerary $itinerary, public User $actor) {}

    public function type(): string
    {
        return NotificationType::TRIP_MEMBER_LEFT;
    }

    public function message(): string
    {
        return $this->actor->name.' left "'.$this->itinerary->title.'".';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips/'.$this->itinerary->id;
    }

    public function extraData(): array
    {
        return array_merge($this->itineraryPayload($this->itinerary), [
            'actor' => $this->actorPayload($this->actor),
        ]);
    }
}
