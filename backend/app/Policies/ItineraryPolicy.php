<?php

namespace App\Policies;

use App\Models\Itinerary;
use App\Models\User;

class ItineraryPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     * Non-members should get 404 (not 403) — enforced by route/model resolution.
     */
    public function view(User $user, Itinerary $itinerary): bool
    {
        $role = $itinerary->roleFor($user);

        return $role === 'owner' || $role === 'editor' || $role === 'viewer';
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Editors and owners can update; viewers cannot.
     */
    public function update(User $user, Itinerary $itinerary): bool
    {
        $role = $itinerary->roleFor($user);

        return $role === 'owner' || $role === 'editor';
    }

    /**
     * Only owner can delete the itinerary.
     */
    public function delete(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) === 'owner';
    }

    /**
     * Any member may duplicate (viewers included). Duplicates are clean copies with no members/invites.
     */
    public function duplicate(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) !== null;
    }

    /**
     * Any member may export.
     */
    public function export(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) !== null;
    }

    /**
     * Only owner can manage members/invites/sharing settings/transfer ownership.
     */
    public function manageMembers(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) === 'owner';
    }

    public function roleFor(User $user, Itinerary $itinerary): ?string
    {
        return $itinerary->roleFor($user);
    }
}
