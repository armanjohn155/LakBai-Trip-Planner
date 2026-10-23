<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItineraryActivityResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'user' => $this->whenLoaded('user', fn () => $this->user?->name),
            'subject_type' => $this->subject_type,
            'subject_id' => $this->subject_id,
            'meta' => $this->meta,
            'created_at' => $this->created_at,
        ];
    }
}
