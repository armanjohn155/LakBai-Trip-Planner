<?php

namespace App\Events;

use App\Models\Itinerary;
use App\Models\ItineraryMeetup;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A member dropped a temporary "meet here" pin for the group.
 */
class MeetupPinned implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Itinerary $itinerary,
        public ItineraryMeetup $meetup,
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("itinerary.{$this->itinerary->id}.tracking");
    }

    public function broadcastAs(): string
    {
        return 'meetup.pinned';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'itinerary_id' => (int) $this->itinerary->id,
            'meetup' => [
                'id' => (int) $this->meetup->id,
                'lat' => (float) $this->meetup->latitude,
                'lng' => (float) $this->meetup->longitude,
                'note' => $this->meetup->note,
                'created_by' => (int) $this->meetup->created_by,
                'created_by_name' => $this->meetup->creator?->name,
                'expires_at' => $this->meetup->expires_at?->toIso8601String(),
            ],
        ];
    }
}
