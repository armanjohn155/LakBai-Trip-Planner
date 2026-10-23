<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Safe projection for `GET /itineraries?filter=invited`. Pending invitees must
 * not see stops, budgets, dates, descriptions or member lists before accepting.
 */
class ItineraryPendingInviteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $member = $this->relationLoaded('members')
            ? $this->members->firstWhere('id', $user?->id)
            : null;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'trip_type' => $this->trip_type,
            'my_role' => null,
            'my_status' => $this->statusFor($user),
            'invited_role' => $member?->pivot?->role,
            'member_count' => $this->whenCounted('members', fn () => (int) $this->members_count),
            'owner' => [
                'id' => $this->user_id,
                'name' => $this->user?->name,
                'username' => $this->user?->username,
                'avatar_url' => $this->user?->avatar_url,
            ],
            'invited_at' => $member?->pivot?->invited_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
