<?php

namespace App\Listeners;

use App\Events\TripCompleted;
use App\Services\TripRecapBuilder;
use Throwable;

/**
 * Finishing a trip is the moment its memory should exist. The listener is
 * intentionally synchronous so the recap is ready when the client is
 * redirected to /app/trips/{id}/recap. A failure is reported but never
 * prevents the trip from being completed; `trips:rebuild-recap` can repair it.
 */
class BuildTripRecap
{
    public function __construct(private readonly TripRecapBuilder $builder) {}

    public function handle(TripCompleted $event): void
    {
        try {
            $this->builder->build($event->itinerary);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
