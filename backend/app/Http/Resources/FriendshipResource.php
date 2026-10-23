<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FriendshipResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $other = $this->otherUser($user);

        return [
            'id' => $this->id,
            'status' => $this->status,
            'requester_id' => $this->requester_id,
            'addressee_id' => $this->addressee_id,
            'responded_at' => $this->responded_at,
            'created_at' => $this->created_at,
            'user' => $other ? new FriendUserResource($other) : null,
        ];
    }
}
