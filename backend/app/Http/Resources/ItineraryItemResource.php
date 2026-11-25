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

        // The parent ItineraryResource flags items when a viewer may not see
        // budget values; default to visible for standalone use (owner/editor).
        $budgetVisible = $this->budgetVisible ?? true;

        $reviewDestinationId = $this->review_destination_id
            ?? $this->destination_id
            ?? $this->visit?->destination_id;

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
            'estimated_budget' => $budgetVisible ? $this->estimated_budget : null,
            'notes' => $this->notes,
            'visited' => (bool) $this->visited,
            'status' => $this->status ?? 'planned',
            'arrived_at' => $this->arrived_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'visit_id' => $this->visit_id,
            'unavailable' => $unavailable,
            'verified' => (bool) ($this->verified ?? false),
            'review_destination_id' => $reviewDestinationId,
            'review_destination_name' => $this->review_destination_name
                ?? $this->destination?->name
                ?? $this->visit?->destination?->name,
            'can_review' => (bool) ($this->can_review ?? false),
            'visit' => $this->whenLoaded('visit', fn () => $this->visit !== null
                ? new VisitResource($this->visit)
                : null),
            'updated_by' => $this->whenLoaded('updatedBy', fn () => $this->updatedBy?->name, fn () => null),
            'destination' => $this->whenLoaded('destination', fn () => $this->destination !== null
                ? new DestinationResource($this->destination)
                : null),
        ];
    }
}
