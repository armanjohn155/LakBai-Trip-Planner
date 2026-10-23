<?php

namespace App\Policies;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;

class ItineraryItemPolicy
{
<<<<<<< HEAD
    /**
     * A stop is viewable when its parent itinerary is viewable.
     */
    public function view(User $user, ItineraryItem $itineraryItem): bool
    {
        return $itineraryItem->itinerary->roleFor($user) !== null;
    }

    public function create(User $user): bool
=======
    public function view(User $user, ItineraryItem $item): bool
    {
        $role = $item->itinerary?->roleFor($user);

        return $role === 'owner' || $role === 'editor' || $role === 'viewer';
    }

    public function create(User $user, Itinerary $itinerary): bool
>>>>>>> origin/main
    {
        $role = $itinerary->roleFor($user);

        return $role === 'owner' || $role === 'editor';
    }

<<<<<<< HEAD
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
=======
    public function update(User $user, ItineraryItem $item): bool
    {
        $role = $item->itinerary?->roleFor($user);

        return $role === 'owner' || $role === 'editor';
    }

    public function delete(User $user, ItineraryItem $item): bool
    {
        $role = $item->itinerary?->roleFor($user);

        return $role === 'owner' || $role === 'editor';
>>>>>>> origin/main
    }
}
