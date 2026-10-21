<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $items = $this->whenLoaded('items');
        $totalEstimated = (float) $this->items->sum('estimated_budget');
        $budgetLimit = $this->total_budget !== null || $this->budget !== null
            ? (float) ($this->total_budget ?? $this->budget)
            : null;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'budget' => $this->budget,
            'total_budget' => $totalEstimated,
            'budget_limit' => $budgetLimit,
            'cover_image_url' => $this->cover_image_url,
            'is_template' => (bool) $this->is_template,
            'template_key' => $this->template_key,
            'day_count' => $this->dayCount(),
            'item_count' => $this->whenCounted('items'),
            'summary' => [
                'total_estimated_budget' => $totalEstimated,
                'budget_limit' => $budgetLimit,
                'remaining_budget' => $budgetLimit !== null ? round($budgetLimit - $totalEstimated, 2) : null,
                'over_budget' => $budgetLimit !== null && $totalEstimated > $budgetLimit,
            ],
            'items' => ItineraryItemResource::collection($items),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
