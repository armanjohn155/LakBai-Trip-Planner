<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryTemplateResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $items = $this->whenLoaded('items');

        return [
            'id' => $this->id,
            'template_key' => $this->template_key,
            'title' => $this->title,
            'description' => $this->description,
            'cover_image_url' => $this->cover_image_url,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'day_count' => $this->dayCount(),
            'item_count' => $this->whenCounted('items'),
            'budget_limit' => $this->total_budget ?? $this->budget,
            'estimated_total' => (float) $this->items->sum('estimated_budget'),
            'items' => ItineraryItemResource::collection($items),
        ];
    }
}
