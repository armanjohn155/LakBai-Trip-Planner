<?php

namespace App\Policies;

use App\Models\Review;
use App\Models\User;

class ReviewPolicy
{
    /**
     * Any authenticated user may attempt to review (verified-visit gating is
     * enforced in the controller where the destination context is available).
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * The author can view their own review at any time.
     */
    public function view(User $user, Review $review): bool
    {
        return $user->id === $review->user_id || $user->isAdmin();
    }

    /**
     * Only the author can edit a review, and only while it is not hidden.
     */
    public function update(User $user, Review $review): bool
    {
        return $user->id === $review->user_id && ! $review->is_hidden;
    }

    /**
     * Only the author can delete a review.
     */
    public function delete(User $user, Review $review): bool
    {
        return $user->id === $review->user_id;
    }

    /**
     * Reportable when authenticated, not the author, not hidden, not yet reported.
     */
    public function report(User $user, Review $review): bool
    {
        if ($user->id === $review->user_id || $review->is_hidden) {
            return false;
        }

        return ! $review->reports()->where('user_id', $user->id)->exists();
    }

    /**
     * Admins may moderate any review.
     */
    public function moderate(User $user, Review|string|null $review = null): bool
    {
        return $user->isAdmin();
    }
}
