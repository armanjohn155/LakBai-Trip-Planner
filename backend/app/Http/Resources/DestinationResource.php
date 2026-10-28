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
        // Build gallery with fallbacks
        $gallery = $this->gallery;
        if (! is_array($gallery) || empty($gallery)) {
            // Fallback to single image_url as one-image gallery
            $gallery = $this->image_url ? [$this->image_url] : [];
        } else {
            // Ensure paths are resolved
            $gallery = array_map(fn ($img) => $this->resolveImageUrl(is_string($img) ? $img : null), $gallery);
            $gallery = array_values(array_filter($gallery));
        }

        $imageUrl = $this->resolveImageUrl($this->image_url);
        if ($imageUrl === null && ! empty($gallery)) {
            $imageUrl = $gallery[0];
        }

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
            'image_url' => $imageUrl,
            'best_time_to_visit' => $this->best_time_to_visit,
            'tips' => $this->tips,
            'deleted_at' => $this->deleted_at,
            'is_favorited' => $this->when($request->user() !== null, fn () => $this->favoritedBy->contains('id', $request->user()->id)),
            'user_visit_status' => $this->when($request->user() !== null, fn () => $this->visitStatusFor($request->user()->id)),
            // New fields
            'highlights' => is_array($this->highlights) ? array_values($this->highlights) : [],
            'entrance_fee_text' => $this->entrance_fee_text,
            'visit_duration' => $this->visit_duration,
            'opening_hours' => $this->opening_hours,
            'how_to_get_there' => is_array($this->how_to_get_there) ? array_values($this->how_to_get_there) : [],
            'travel_tips' => is_array($this->travel_tips) ? array_values($this->travel_tips) : (is_string($this->tips) && $this->tips !== '' ? array_values(array_filter(array_map('trim', preg_split('/[\r\n]+/', $this->tips))))) : [],
            'gallery' => $gallery,
        ];
    }

    /**
     * Uploaded images are stored as "/storage/..." relative paths; convert them
     * to absolute URLs so clients on another origin (e.g. Vite on :5173) can
     * load them. Seeded "/images/..." paths are served by the frontend itself
     * and are returned unchanged.
     */
    private function resolveImageUrl(?string $imageUrl): ?string
    {
        if ($imageUrl === null || ! is_string($imageUrl)) {
            return null;
        }

        if (str_starts_with($imageUrl, '/storage/')) {
            return asset(ltrim($imageUrl, '/'));
        }

        if (str_starts_with($imageUrl, 'http://') || str_starts_with($imageUrl, 'https://')) {
            return $imageUrl;
        }

        return $imageUrl;
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
