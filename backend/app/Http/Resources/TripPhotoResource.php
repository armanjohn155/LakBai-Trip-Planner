<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TripPhotoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'itinerary_id' => $this->itinerary_id,
            'itinerary_item_id' => $this->itinerary_item_id,
            'user_id' => $this->user_id,
            'url' => $this->absoluteUrl(),
            'thumbnail_url' => $this->thumbnailUrl(),
            'caption' => $this->caption,
            'taken_at' => $this->taken_at?->toIso8601String(),
            'position' => (int) $this->position,
            'is_hidden' => (bool) $this->is_hidden,
        ];
    }
}
