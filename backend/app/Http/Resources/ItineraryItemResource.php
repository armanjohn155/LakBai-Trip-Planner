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
        return [
            'id' => $this->id,
            'itinerary_id' => $this->itinerary_id,
            'destination_id' => $this->destination_id,
            'day_number' => $this->day_number,
            'order' => $this->order,
            'estimated_budget' => $this->estimated_budget,
            'notes' => $this->notes,
            'visited' => (bool) $this->visited,
            'destination' => new DestinationResource($this->whenLoaded('destination')),
        ];
    }
}
