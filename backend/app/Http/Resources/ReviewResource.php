<?php

namespace App\Http\Resources;

use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public-facing review payload. Never exposes the author's email.
 */
class ReviewResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Review $review */
        $review = $this->resource;
        $user = $request->user();

        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'title' => $this->title,
            'body' => $this->body,
            'visited_on' => $this->visited_on?->toDateString(),
            'is_hidden' => (bool) $this->is_hidden,
            'hidden_reason' => $this->when($user?->isAdmin(), $this->hidden_reason),
            'edited_at' => $this->edited_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'author' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
            ],
            'destination' => $this->whenLoaded('destination', fn () => [
                'id' => $this->destination->id,
                'name' => $this->destination->name,
            ]),
            'photos' => ReviewPhotoResource::collection($this->whenLoaded('photos')),
            'report_count' => $this->when($user?->isAdmin(), fn () => $this->reports()->count()),
            'can' => $this->when($user !== null, fn () => [
                'update' => $user->can('update', $review),
                'delete' => $user->can('delete', $review),
                'report' => $user->can('report', $review),
            ]),
        ];
    }
}
