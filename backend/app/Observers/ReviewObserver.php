<?php

namespace App\Observers;

use App\Models\Review;
use App\Services\ReviewStatsService;
use Illuminate\Support\Facades\DB;

class ReviewObserver
{
    public function __construct(private readonly ReviewStatsService $stats) {}

    public function created(Review $review): void
    {
        $this->recalculate($review);
    }

    public function updated(Review $review): void
    {
        if ($review->wasChanged(['rating', 'is_hidden'])) {
            $this->recalculate($review);
        }
    }

    public function deleted(Review $review): void
    {
        $this->recalculate($review);
    }

    public function restored(Review $review): void
    {
        $this->recalculate($review);
    }

    private function recalculate(Review $review): void
    {
        // Wrap in its own transaction so a failed recalculation never leaves a
        // destination with a half-updated rating.
        DB::transaction(function () use ($review) {
            $destination = $review->destination()->withTrashed()->first();

            if ($destination !== null) {
                $this->stats->recalculate($destination);
            }
        });
    }
}
