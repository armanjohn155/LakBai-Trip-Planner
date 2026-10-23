<?php

namespace App\Events;

use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReviewReported
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Review $review,
        public User $reporter,
        public ?string $reason = null,
    ) {}
}
