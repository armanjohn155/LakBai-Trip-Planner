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
 * A member opted in or out of group sharing. Clients use this to add or
 * immediately remove a marker without waiting for a poll.
 */
class MemberSharingChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Itinerary $itinerary,
        public User $member,
        public bool $sharing,
        public string $reason,
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("itinerary.{$this->itinerary->id}.tracking");
    }

    public function broadcastAs(): string
    {
        return 'member.sharing';
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
            'sharing' => $this->sharing,
            'reason' => $this->reason,
        ];
    }
}
