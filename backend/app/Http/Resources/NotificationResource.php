<?php

namespace App\Http\Resources;

use App\Support\NotificationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

/**
 * @mixin \Illuminate\Notifications\DatabaseNotification
 */
class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = $this->data ?? [];

        return [
            'id' => $this->id,
            'type' => $this->type,
            'message' => $data['message'] ?? '',
            'action_url' => $data['action_url'] ?? null,
            'actionable' => $this->isActionable($request, $data),
            'data' => $data,
            'read' => $this->read_at !== null,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Invitations stop being actionable as soon as the membership is no longer
     * pending (accepted, declined, removed, or the trip was deleted).
     *
     * @param  array<string, mixed>  $data
     */
    private function isActionable(Request $request, array $data): bool
    {
        $actionable = (bool) ($data['actionable'] ?? true);
        $user = $request->user();

        if (! $actionable || ! $user || $this->type !== NotificationType::TRIP_INVITE_RECEIVED) {
            return $actionable;
        }

        $itineraryId = (int) ($data['itinerary_id'] ?? 0);

        if ($itineraryId === 0) {
            return false;
        }

        $status = DB::table('itinerary_user')
            ->where('itinerary_id', $itineraryId)
            ->where('user_id', $user->id)
            ->value('status');

        return $status === 'pending';
    }
}
