<?php

namespace App\Events;

use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TripUpdated
{
    use Dispatchable, SerializesModels;

    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public Itinerary $itinerary,
        public ?User $actor,
        public string $action,
        public array $meta = [],
    ) {}
}
