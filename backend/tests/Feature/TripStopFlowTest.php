<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TripStopFlowTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_arrive_records_arrival_without_creating_a_visit(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/arrive")
            ->assertOk()
            ->assertJsonPath('stop.status', 'arrived')
            ->assertJsonPath('tracking.next_stop.status', 'arrived');

        $item->refresh();

        $this->assertNotNull($item->arrived_at);
        $this->assertNull($item->completed_at);
        $this->assertDatabaseCount('visits', 0);
    }

    public function test_complete_verifies_proximity_and_records_a_gps_visit(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $response = $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0005,
                'longitude' => 123.0,
                'accuracy' => 15,
            ])
            ->assertOk()
            ->assertJsonPath('stop.status', 'done')
            ->assertJsonPath('stop.visited', true)
            ->assertJsonPath('can_review', true);

        $visitId = (int) $response->json('visit.id');
        $this->assertGreaterThan(0, $visitId);

        $item->refresh();

        $this->assertSame($visitId, $item->visit_id);
        $this->assertSame('done', $item->status);
        $this->assertNotNull($item->arrived_at);
        $this->assertNotNull($item->completed_at);
        $this->assertDatabaseHas('visits', [
            'id' => $visitId,
            'user_id' => $user->id,
            'destination_id' => $item->destination_id,
            'itinerary_stop_id' => $item->id,
            'verified' => true,
            'method' => 'gps',
        ]);
    }

    public function test_complete_fails_when_the_traveller_is_too_far_away(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.01,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'distance')
            ->assertJsonPath('can_retry', true);

        $this->assertSame('planned', $item->refresh()->status);
        $this->assertDatabaseCount('visits', 0);
    }

    public function test_complete_fails_with_poor_gps_accuracy(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 500,
            ])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'accuracy');

        $this->assertDatabaseCount('visits', 0);
    }

    public function test_complete_is_blocked_while_the_trip_is_paused(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/pause")
            ->assertOk();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(409);

        $this->assertSame('planned', $item->refresh()->status);
    }

    public function test_complete_is_blocked_before_the_trip_starts(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->plannedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(409);
    }

    public function test_a_stop_can_be_skipped_and_undone(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/skip")
            ->assertOk()
            ->assertJsonPath('stop.status', 'skipped');

        $this->assertNotNull($item->refresh()->completed_at);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/undo")
            ->assertOk()
            ->assertJsonPath('stop.status', 'planned');

        $item->refresh();

        $this->assertNull($item->completed_at);
        $this->assertNull($item->arrived_at);
        $this->assertDatabaseCount('visits', 0);
    }

    public function test_undo_after_completion_removes_the_gps_visit(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertOk();

        $this->assertDatabaseCount('visits', 1);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/undo")
            ->assertOk()
            ->assertJsonPath('stop.status', 'planned')
            ->assertJsonPath('stop.visited', false);

        $item->refresh();

        $this->assertNull($item->visit_id);
        $this->assertNull($item->completed_at);
        $this->assertDatabaseCount('visits', 0);
    }

    public function test_undo_is_rejected_after_the_ten_minute_window(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/skip")
            ->assertOk();

        $item->forceFill(['completed_at' => now()->subMinutes(11)])->save();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/undo")
            ->assertStatus(422)
            ->assertJsonPath('message', 'The undo window for this stop has closed.');
    }

    public function test_a_visited_stop_cannot_be_skipped(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertOk();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/skip")
            ->assertStatus(422);
    }

    public function test_custom_stop_completion_verifies_distance_without_a_visit(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, custom: true);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0005,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertOk()
            ->assertJsonPath('stop.status', 'done')
            ->assertJsonPath('visit', null);

        $this->assertNull($item->refresh()->visit_id);
        $this->assertDatabaseCount('visits', 0);
    }

    public function test_custom_stop_completion_fails_when_too_far(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, custom: true);
        $item = $itinerary->items()->firstOrFail();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.1,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'distance');
    }

    public function test_a_second_completion_during_cooldown_returns_429(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);
        $item = $itinerary->items()->firstOrFail();

        Visit::factory()->verified()->for($user)->for($item->destination)->create([
            'visited_at' => now()->subHour(),
        ]);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(429)
            ->assertJsonPath('reason', 'cooldown');
    }

    private function plannedTrip(User $user, bool $custom = false): Itinerary
    {
        $itinerary = Itinerary::factory()->for($user)->create();

        if ($custom) {
            ItineraryItem::factory()->for($itinerary)->create([
                'destination_id' => null,
                'custom_title' => 'Roadside cafe',
                'custom_latitude' => 10.0,
                'custom_longitude' => 123.0,
                'custom_address' => 'Somewhere',
                'order' => 0,
            ]);
        } else {
            $destination = Destination::factory()->create([
                'name' => 'Test Stop',
                'latitude' => 10.0,
                'longitude' => 123.0,
                'radius_m' => 150,
            ]);

            ItineraryItem::factory()->for($itinerary)->for($destination)->create(['order' => 0]);
        }

        return $itinerary->refresh();
    }

    private function startedTrip(User $user, bool $custom = false): Itinerary
    {
        $itinerary = $this->plannedTrip($user, $custom);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertOk();

        return $itinerary->refresh();
    }
}
