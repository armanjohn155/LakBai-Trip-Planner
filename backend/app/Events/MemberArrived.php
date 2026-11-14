<?php

namespace App\Events;

use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A sharing member reached a stop. The payload contains the stop, never a
 * raw coordinate trail, and never any contact details.
 */
class MemberArrived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Itinerary $itinerary,
        public User $member,
        public int $itemId,
        public string $itemTitle,
        public string $arrivedAt,
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("itinerary.{$this->itinerary->id}.tracking");
    }

    public function broadcastAs(): string
    {
        return 'member.arrived';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'itinerary_id' => (int) $this->itinerary->id,
            'user_id' => (int) $this->member->id,
            'name' => $this->member->name,
            'avatar_url' => $this->member->avatar_url,
            'stop_id' => $this->itemId,
            'stop_title' => $this->itemTitle,
            'arrived_at' => $this->arrivedAt,
        ];
    }
}
