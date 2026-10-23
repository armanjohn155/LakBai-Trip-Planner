<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();
        $role = $this->roleFor($user);

        // Viewers see budget values only when the owner shares them.
        $canSeeBudget = $role !== null && ($role !== \App\Models\Itinerary::ROLE_VIEWER || (bool) $this->share_budget);

        $items = $this->whenLoaded('items');

        // Propagate budget visibility to each stop when serializing viewers.
        if ($this->relationLoaded('items')) {
            $this->items->each(fn ($item) => $item->budgetVisible = $canSeeBudget);
        }

        $totalEstimated = (float) $this->items->sum('estimated_budget');
        $budgetLimit = $this->total_budget !== null || $this->budget !== null
            ? (float) ($this->total_budget ?? $this->budget)
            : null;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'budget' => $canSeeBudget ? $this->budget : null,
            'total_budget' => $canSeeBudget ? $totalEstimated : null,
            'budget_limit' => $canSeeBudget ? $budgetLimit : null,
            'cover_image_url' => $this->cover_image_url,
            'is_template' => (bool) $this->is_template,
            'template_key' => $this->template_key,
            'trip_type' => $this->trip_type ?? \App\Models\Itinerary::TRIP_SOLO,
            'version' => (int) $this->version,
            'share_budget' => (bool) $this->share_budget,
            'my_role' => $role,
            'my_status' => $this->statusFor($user),
            'is_shared' => $role !== null && $role !== \App\Models\Itinerary::ROLE_OWNER,
            'member_count' => $this->whenCounted('members', fn () => (int) $this->members_count),
            'owner' => [
                'id' => $this->user_id,
                'name' => $this->whenLoaded('user', fn () => $this->user?->name, fn () => null),
                'username' => $this->whenLoaded('user', fn () => $this->user?->username, fn () => null),
                'avatar_url' => $this->whenLoaded('user', fn () => $this->user?->avatar_url, fn () => null),
            ],
            'members' => $this->whenLoaded('members', fn () => $this->members->map(fn ($member) => [
                'id' => $member->id,
                'name' => $member->name,
                'username' => $member->username,
                'avatar_url' => $member->avatar_url,
                'role' => $member->pivot?->role,
                'status' => $member->pivot?->status,
            ])->values()),
            'updated_by' => $this->whenLoaded('updatedBy', fn () => $this->updatedBy?->name, fn () => null),
            'day_count' => $this->dayCount(),
            'item_count' => $this->whenCounted('items'),
            'summary' => [
                'total_estimated_budget' => $canSeeBudget ? $totalEstimated : null,
                'budget_limit' => $canSeeBudget ? $budgetLimit : null,
                'remaining_budget' => $canSeeBudget && $budgetLimit !== null ? round($budgetLimit - $totalEstimated, 2) : null,
                'over_budget' => $canSeeBudget && $budgetLimit !== null && $totalEstimated > $budgetLimit,
            ],
            'items' => ItineraryItemResource::collection($items),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
