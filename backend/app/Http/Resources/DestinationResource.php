<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DestinationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category,
            'region' => $this->region,
            'municipality' => $this->municipality,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'estimated_cost' => $this->estimated_cost,
            'rating' => $this->rating,
            'review_count' => $this->review_count,
            'image_url' => $this->image_url,
            'best_time_to_visit' => $this->best_time_to_visit,
            'tips' => $this->tips,
            'is_favorited' => $this->when($request->user() !== null, fn () => $this->favoritedBy->contains('id', $request->user()->id)),
        ];
    }
}
