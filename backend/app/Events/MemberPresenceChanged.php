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
 * Online/offline transitions are derived from ping age. Offline is emitted by
 * the scheduled presence sweep; online is emitted with the first fresh ping.
 */
class MemberPresenceChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Itinerary $itinerary,
        public User $member,
        public bool $online,
        public ?string $lastSeenAt,
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("itinerary.{$this->itinerary->id}.tracking");
    }

    public function broadcastAs(): string
    {
        return 'member.presence';
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
            'online' => $this->online,
            'last_seen_at' => $this->lastSeenAt,
        ];
    }
}
