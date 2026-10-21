<?php

namespace App\Http\Resources;

use App\Models\Visit;
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
            'radius_m' => $this->radius_m,
            'estimated_cost' => $this->estimated_cost,
            'rating' => $this->rating,
            'review_count' => $this->review_count,
            'lakbai_review_count' => $this->lakbai_review_count,
            'image_url' => $this->image_url,
            'best_time_to_visit' => $this->best_time_to_visit,
            'tips' => $this->tips,
            'deleted_at' => $this->deleted_at,
            'is_favorited' => $this->when($request->user() !== null, fn () => $this->favoritedBy->contains('id', $request->user()->id)),
            'user_visit_status' => $this->when($request->user() !== null, fn () => $this->visitStatusFor($request->user()->id)),
        ];
    }

    /**
     * Derive the "none | manual | verified" status from the eager-loaded,
     * user-scoped visits relation so there is no query per destination.
     */
    private function visitStatusFor(int $userId): string
    {
        if (! $this->relationLoaded('visits')) {
            return 'none';
        }

        $visits = $this->visits->where('user_id', $userId);

        if ($visits->contains(fn (Visit $visit) => $visit->verified)) {
            return 'verified';
        }

        return $visits->isNotEmpty() ? 'manual' : 'none';
    }
}
