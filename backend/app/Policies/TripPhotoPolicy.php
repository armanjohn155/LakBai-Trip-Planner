<?php

namespace App\Policies;

use App\Models\Itinerary;
use App\Models\TripPhoto;
use App\Models\User;

class TripPhotoPolicy
{
    /**
     * Any member of the trip may see its photos.
     */
    public function view(User $user, TripPhoto $photo): bool
    {
        return $photo->itinerary?->roleFor($user) !== null;
    }

    /**
     * Owners and editors may add photos, even after the trip is completed.
     * Viewers are read-only.
     */
    public function create(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->isEditableBy($user);
    }

    /**
     * The uploader edits their own photo; the trip owner can moderate all.
     */
    public function update(User $user, TripPhoto $photo): bool
    {
        $itinerary = $photo->itinerary;

        if ($itinerary === null || ! $itinerary->isEditableBy($user)) {
            return false;
        }

        return (int) $itinerary->user_id === (int) $user->id
            || (int) $photo->user_id === (int) $user->id;
    }

    /**
     * Deleting follows the same rule as editing.
     */
    public function delete(User $user, TripPhoto $photo): bool
    {
        return $this->update($user, $photo);
    }
}
