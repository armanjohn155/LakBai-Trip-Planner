<?php

namespace App\Events;

use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Domain event for the trip lifecycle. Listeners (notifications, analytics)
 * are intentionally added later so solo tracking has no notification noise.
 */
class StopArrived
{
    use Dispatchable, SerializesModels;

    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public Itinerary $itinerary,
        public ?User $actor,
        public array $meta = [],
    ) {}
}
