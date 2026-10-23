<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

class TripMemberRemovedNotification extends AppNotification
{
    public function __construct(public Itinerary $itinerary, public User $actor) {}

    public function type(): string
    {
        return NotificationType::TRIP_MEMBER_REMOVED;
    }

    public function message(): string
    {
        return $this->actor->name.' removed you from "'.$this->itinerary->title.'".';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips';
    }

    public function extraData(): array
    {
        return array_merge($this->itineraryPayload($this->itinerary), [
            'actor' => $this->actorPayload($this->actor),
        ]);
    }
}
