<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

class TripMemberJoinedNotification extends AppNotification
{
    public function __construct(public Itinerary $itinerary, public User $actor) {}

    public function type(): string
    {
        return NotificationType::TRIP_MEMBER_JOINED;
    }

    public function message(): string
    {
        return $this->actor->name.' joined "'.$this->itinerary->title.'".';
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
