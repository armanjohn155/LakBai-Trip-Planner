<?php

namespace App\Listeners;

use App\Events\TripDeleted;
use App\Services\TripPhotoService;
use Throwable;

/**
 * TripDeleted fires before the row is removed. Clean up files first so a
 * database cascade cannot orphan them on the public disk.
 */
class CleanupTripPhotos
{
    public function __construct(private readonly TripPhotoService $photos) {}

    public function handle(TripDeleted $event): void
    {
        try {
            $this->photos->deleteForItinerary($event->itinerary);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
