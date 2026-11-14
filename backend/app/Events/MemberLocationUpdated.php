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
 * Latest shared position for one group member. Broadcast at most once per
 * configured interval; the full payload is deliberately tiny because the
 * client replaces the previous marker instead of drawing a route.
 */
class MemberLocationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Itinerary $itinerary,
        public User $member,
        public float $lat,
        public float $lng,
        public ?int $accuracyM,
        public string $recordedAt,
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("itinerary.{$this->itinerary->id}.tracking");
    }

    public function broadcastAs(): string
    {
        return 'member.location';
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
            'lat' => $this->lat,
            'lng' => $this->lng,
            'accuracy_m' => $this->accuracyM,
            'recorded_at' => $this->recordedAt,
        ];
    }
}
