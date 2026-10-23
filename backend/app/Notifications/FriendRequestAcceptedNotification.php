<?php

namespace App\Notifications;

use App\Models\Friendship;
use App\Models\User;
use App\Support\NotificationType;

class FriendRequestAcceptedNotification extends AppNotification
{
    public function __construct(public Friendship $friendship, public User $actor) {}

    public function type(): string
    {
        return NotificationType::FRIEND_REQUEST_ACCEPTED;
    }

    public function message(): string
    {
        return $this->actor->name.' accepted your friend request.';
    }

    public function actionUrl(): ?string
    {
        return '/app/friends';
    }

    public function extraData(): array
    {
        return [
            'friendship_id' => (int) $this->friendship->id,
            'actor' => $this->actorPayload($this->actor),
        ];
    }
}
