<?php

namespace App\Policies;

use App\Models\ItineraryItem;
use App\Models\User;

class ItineraryItemPolicy
{
    /**
     * A stop is viewable when its parent itinerary is viewable.
     */
    public function view(User $user, ItineraryItem $itineraryItem): bool
    {
        return $itineraryItem->itinerary->roleFor($user) !== null;
    }

    public function create(User $user): bool
    {
        return true;
    }

    /**
     * A stop is editable when the user can edit its parent itinerary
     * (owner or editor).
     */
    public function update(User $user, ItineraryItem $itineraryItem): bool
    {
        return $itineraryItem->itinerary->isEditableBy($user);
    }

    /**
     * Deleting a stop follows the same rule as editing it.
     */
    public function delete(User $user, ItineraryItem $itineraryItem): bool
    {
        return $itineraryItem->itinerary->isEditableBy($user);
    }
}
