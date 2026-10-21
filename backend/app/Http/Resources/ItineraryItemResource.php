<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryItemResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hasDestination = $this->destination_id !== null;
        $destinationLoaded = $this->relationLoaded('destination');
        $unavailable = $hasDestination && $destinationLoaded
            && ($this->destination === null || $this->destination->trashed());

        return [
            'id' => $this->id,
            'itinerary_id' => $this->itinerary_id,
            'destination_id' => $this->destination_id,
            'custom_title' => $this->custom_title,
            'custom_latitude' => $this->custom_latitude,
            'custom_longitude' => $this->custom_longitude,
            'custom_address' => $this->custom_address,
            'is_custom' => $this->isCustom(),
            'title' => $this->resolvedTitle(),
            'category' => $this->resolvedCategory(),
            'latitude' => $this->resolvedCoordinates()[0] ?? null,
            'longitude' => $this->resolvedCoordinates()[1] ?? null,
            'day_number' => $this->day_number,
            'order' => $this->order,
            'start_time' => $this->start_time,
            'duration_minutes' => $this->duration_minutes,
            'estimated_budget' => $this->estimated_budget,
            'notes' => $this->notes,
            'visited' => (bool) $this->visited,
            'status' => $this->status ?? 'planned',
            'unavailable' => $unavailable,
            'verified' => (bool) ($this->verified ?? false),
            'destination' => new DestinationResource($this->whenLoaded('destination')),
        ];
    }
}
