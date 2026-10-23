<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryInviteResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'type' => $this->type,
            'role' => $this->role,
            'max_uses' => $this->max_uses,
            'uses_count' => $this->uses_count,
            'expires_at' => $this->expires_at,
            'revoked_at' => $this->revoked_at,
            'created_at' => $this->created_at,
            'is_redeemable' => $this->isRedeemable(),
        ];
    }
}
