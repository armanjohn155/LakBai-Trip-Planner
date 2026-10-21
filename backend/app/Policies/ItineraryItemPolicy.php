<?php

namespace App\Policies;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;

class ItineraryItemPolicy
{
    public function view(User $user, ItineraryItem $item): bool
    {
        $role = $item->itinerary?->roleFor($user);

        return $role === 'owner' || $role === 'editor' || $role === 'viewer';
    }

    public function create(User $user, Itinerary $itinerary): bool
    {
        $role = $itinerary->roleFor($user);

        return $role === 'owner' || $role === 'editor';
    }

    public function update(User $user, ItineraryItem $item): bool
    {
        $role = $item->itinerary?->roleFor($user);

        return $role === 'owner' || $role === 'editor';
    }

    public function delete(User $user, ItineraryItem $item): bool
    {
        $role = $item->itinerary?->roleFor($user);

        return $role === 'owner' || $role === 'editor';
    }
}
