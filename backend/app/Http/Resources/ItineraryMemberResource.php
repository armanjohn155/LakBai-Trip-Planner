<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public member projection for shared trips. Emails and other private data are
 * never exposed.
 */
class ItineraryMemberResource extends JsonResource
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
            'username' => $this->username,
            'avatar_url' => $this->avatar_url,
            'role' => $this->pivot->role ?? null,
            'status' => $this->pivot->status ?? null,
            'rsvp' => $this->pivot->rsvp ?? null,
            'invited_at' => $this->pivot->invited_at ?? null,
            'responded_at' => $this->pivot->responded_at ?? null,
            'joined_at' => $this->pivot->joined_at ?? null,
        ];
    }
}
