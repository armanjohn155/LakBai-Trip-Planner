<?php

namespace App\Events;

use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReviewHidden
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Review $review,
        public User $actor,
        public ?string $reason = null,
    ) {}
}
