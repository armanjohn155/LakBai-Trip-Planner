<?php

namespace App\Events;

use App\Models\Friendship;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FriendRequestSent
{
    use Dispatchable, SerializesModels;

    public function __construct(public Friendship $friendship, public User $requester, public User $addressee) {}
}
