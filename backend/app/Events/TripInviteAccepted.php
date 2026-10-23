<?php

namespace App\Events;

use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TripInviteAccepted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Itinerary $itinerary,
        public User $user,
        public string $role,
    ) {}
}
