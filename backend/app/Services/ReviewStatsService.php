<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\Review;

/**
 * Recalculates a destination's displayed rating and review count from its
 * visible Lakbai reviews, weighted against the imported baseline.
 */
class ReviewStatsService
{
    /**
     * Recalculate and persist the derived rating fields for one destination.
     */
    public function recalculate(Destination $destination): void
    {
        $visible = Review::query()
            ->where('destination_id', $destination->id)
            ->visible();

        $count = (clone $visible)->count();
        $sum = $count > 0 ? (int) (clone $visible)->sum('rating') : 0;

        $baseRating = $destination->base_rating !== null ? (float) $destination->base_rating : 0.0;
        $baseCount = (int) $destination->base_review_count;

        $destination->forceFill([
            'lakbai_review_count' => $count,
            'lakbai_rating_avg' => $count > 0 ? round($sum / $count, 2) : null,
            'review_count' => $baseCount + $count,
            'rating' => $this->displayRating($baseRating, $baseCount, $sum, $count),
        ])->save();
    }

    /**
     * Recalculate every destination (used by the artisan command).
     */
    public function recalculateAll(): int
    {
        $count = 0;

        Destination::query()->withTrashed()->chunkById(100, function ($destinations) use (&$count) {
            foreach ($destinations as $destination) {
                $this->recalculate($destination);
                $count++;
            }
        });

        return $count;
    }

    /**
     * Weighted average of the imported baseline and Lakbai's own reviews.
     *
     * The baseline is weighted by its full review count so a handful of new
     * Lakbai reviews cannot swing a destination that already has a large,
     * credible history — while destinations with little or no baseline still
     * move naturally as genuine verified reviews arrive.
     */
    private function displayRating(float $baseRating, int $baseCount, int $reviewSum, int $reviewCount): float
    {
        if ($reviewCount === 0) {
            return round($baseRating, 1);
        }

        if ($baseCount === 0) {
            return round($reviewSum / $reviewCount, 1);
        }

        $weighted = (($baseRating * $baseCount) + $reviewSum) / ($baseCount + $reviewCount);

        return round($weighted, 1);
    }
}
