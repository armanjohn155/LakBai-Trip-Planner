<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VisitResource extends JsonResource
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
            'destination_id' => $this->destination_id,
            'itinerary_stop_id' => $this->itinerary_stop_id,
            'verified' => (bool) $this->verified,
            'method' => $this->method,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'distance_m' => $this->distance_m,
            'accuracy_m' => $this->accuracy_m,
            'visited_at' => $this->visited_at?->toIso8601String(),
            'notes' => $this->notes,
            'destination' => new DestinationResource($this->whenLoaded('destination')),
        ];
    }
}
