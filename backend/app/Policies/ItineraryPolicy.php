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
     */
    public function view(User $user, Itinerary $itinerary): bool
    {
        return $this->isOwner($user, $itinerary);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Itinerary $itinerary): bool
    {
        return $this->isOwner($user, $itinerary);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Itinerary $itinerary): bool
    {
        return $this->isOwner($user, $itinerary);
    }

    /**
     * Determine whether the user can duplicate the model. Only owners may
     * duplicate; this mirrors the update permission today and is a separate
     * ability so sharing roles can diverge later.
     */
    public function duplicate(User $user, Itinerary $itinerary): bool
    {
        return $this->isOwner($user, $itinerary);
    }

    /**
     * Determine whether the user can export the model (PDF/ICS/GPX).
     */
    public function export(User $user, Itinerary $itinerary): bool
    {
        return $this->isOwner($user, $itinerary);
    }

    /**
     * Owner-only for now. When itinerary sharing lands, replace this with a
     * role lookup (owner / editor / viewer) and branch each ability above.
     */
    private function isOwner(User $user, Itinerary $itinerary): bool
    {
        return $itinerary->user_id === $user->id;
    }
}
