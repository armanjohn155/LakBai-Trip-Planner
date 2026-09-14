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
        return [
            'itinerary_id' => $this->id,
            'title' => $this->title,
            'budget' => $this->budget,
            'total_budget' => $this->total_budget,
            'item_count' => $this->items->count(),
            'day_count' => $this->items->pluck('day_number')->unique()->count(),
            'breakdown_by_category' => $this->items
                ->groupBy('destination.category')
                ->map(fn ($items, string $category) => [
                    'category' => $category,
                    'item_count' => $items->count(),
                    'estimated_budget' => (float) $items->sum('estimated_budget'),
                ])
                ->values(),
        ];
    }
}
