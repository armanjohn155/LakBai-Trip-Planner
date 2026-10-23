<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

class TripRoleChangedNotification extends AppNotification
{
    public function __construct(public Itinerary $itinerary, public User $actor, public string $role) {}

    public function type(): string
    {
        return NotificationType::TRIP_ROLE_CHANGED;
    }

    public function message(): string
    {
        return 'Your role in "'.$this->itinerary->title.'" is now '.$this->role.'.';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips/'.$this->itinerary->id;
    }

    public function extraData(): array
    {
        return array_merge($this->itineraryPayload($this->itinerary), [
            'role' => $this->role,
            'actor' => $this->actorPayload($this->actor),
        ]);
    }
}
