<?php

namespace App\Policies;

use App\Models\Itinerary;
use App\Models\User;

class ItineraryPolicy
{
    /**
     * Determine whether the user can list itineraries. The index endpoint
     * further scopes results to owned + shared.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
<<<<<<< HEAD
     * Determine whether the user can view the model. Owners, editors and
     * viewers may view; everyone else is denied (the resource layer turns a
     * denied view into a 404 so membership is never leaked).
     */
    public function view(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) !== null;
=======
     * Determine whether the user can view the model.
     * Non-members should get 404 (not 403) — enforced by route/model resolution.
     */
    public function view(User $user, Itinerary $itinerary): bool
    {
        $role = $itinerary->roleFor($user);

        return $role === 'owner' || $role === 'editor' || $role === 'viewer';
>>>>>>> origin/main
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
<<<<<<< HEAD
     * Determine whether the user can update the model (details, stops,
     * reorder, notes). Owners and editors may edit; viewers may not.
     */
    public function update(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->isEditableBy($user);
    }

    /**
     * Determine whether the user can delete the model. Owner only.
     */
    public function delete(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) === Itinerary::ROLE_OWNER;
    }

    /**
     * Manage members, invites and sharing settings. Owner only.
=======
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
>>>>>>> origin/main
     */
    public function manageMembers(User $user, Itinerary $itinerary): bool
    {
<<<<<<< HEAD
        return $itinerary->roleFor($user) === Itinerary::ROLE_OWNER;
    }

    /**
     * Any member (owner, editor, viewer) may export.
=======
        return $itinerary->roleFor($user) !== null;
    }

    /**
     * Any member may export.
>>>>>>> origin/main
     */
    public function export(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) !== null;
    }

    /**
<<<<<<< HEAD
     * Any member may duplicate into their own account, producing a fresh
     * itinerary with no members or invites. Non-members are denied.
     */
    public function duplicate(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) !== null;
    }

    /**
     * Transfer ownership. Owner only.
     */
    public function transferOwnership(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) === Itinerary::ROLE_OWNER;
=======
     * Only owner can manage members/invites/sharing settings/transfer ownership.
     */
    public function manageMembers(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->roleFor($user) === 'owner';
    }

    public function roleFor(User $user, Itinerary $itinerary): ?string
    {
        return $itinerary->roleFor($user);
>>>>>>> origin/main
    }
}
