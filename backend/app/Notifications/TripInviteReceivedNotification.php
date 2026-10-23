<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Models\User;
use App\Support\NotificationType;

class TripInviteReceivedNotification extends AppNotification
{
    public function __construct(public Itinerary $itinerary, public User $actor, public string $role) {}

    public function type(): string
    {
        return NotificationType::TRIP_INVITE_RECEIVED;
    }

    public function message(): string
    {
        return $this->actor->name.' invited you to "'.$this->itinerary->title.'" as '.$this->role.'.';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips?tab=invites';
    }

    public function extraData(): array
    {
        return array_merge($this->itineraryPayload($this->itinerary), [
            'role' => $this->role,
            'actor' => $this->actorPayload($this->actor),
            'actionable' => true,
        ]);
    }
}
