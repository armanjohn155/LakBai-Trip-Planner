<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItinerarySummaryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $items = $this->items;
        $totalEstimated = (float) $items->sum('estimated_budget');
        $budgetLimit = $this->total_budget !== null || $this->budget !== null
            ? (float) ($this->total_budget ?? $this->budget)
            : null;

        $role = $this->roleFor($request->user());
        $canSeeBudget = $role !== null && ($role !== \App\Models\Itinerary::ROLE_VIEWER || (bool) $this->share_budget);

        if (! $canSeeBudget) {
            return [
                'itinerary_id' => $this->id,
                'title' => $this->title,
                'budget' => null,
                'total_budget' => null,
                'budget_limit' => null,
                'remaining_budget' => null,
                'over_budget' => false,
                'item_count' => $items->count(),
                'day_count' => $items->pluck('day_number')->unique()->count(),
                'total_duration_minutes' => (int) $items->sum('duration_minutes'),
                'days' => $this->dayBreakdown()->map(fn (array $day) => [...$day, 'estimated_budget' => null])->all(),
                'breakdown_by_category' => [],
            ];
        }

        return [
            'itinerary_id' => $this->id,
            'title' => $this->title,
            'budget' => $this->budget,
            'total_budget' => $totalEstimated,
            'budget_limit' => $budgetLimit,
            'remaining_budget' => $budgetLimit !== null ? round($budgetLimit - $totalEstimated, 2) : null,
            'over_budget' => $budgetLimit !== null && $totalEstimated > $budgetLimit,
            'item_count' => $items->count(),
            'day_count' => $items->pluck('day_number')->unique()->count(),
            'total_duration_minutes' => (int) $items->sum('duration_minutes'),
            'days' => $this->dayBreakdown(),
            'breakdown_by_category' => $items
                ->groupBy(fn ($item) => $item->resolvedCategory())
                ->map(fn ($group, string $category) => [
                    'category' => $category,
                    'item_count' => $group->count(),
                    'estimated_budget' => (float) $group->sum('estimated_budget'),
                ])
                ->values(),
        ];
    }

    /**
     * Per-day totals: stop count, budget subtotal and planned duration.
     *
     * @return array<int, array<string, mixed>>
     */
    private function dayBreakdown(): array
    {
        return $this->items
            ->groupBy('day_number')
            ->sortKeys()
            ->map(fn ($group, $day) => [
                'day_number' => (int) $day,
                'item_count' => $group->count(),
                'estimated_budget' => (float) $group->sum('estimated_budget'),
                'duration_minutes' => (int) $group->sum('duration_minutes'),
            ])
            ->values()
            ->all();
    }
}
