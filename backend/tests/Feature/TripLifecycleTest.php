<?php

namespace Tests\Feature;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TripLifecycleTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_owner_can_start_a_planned_trip_with_stops(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->for($itinerary)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start", [
                'base_version' => $itinerary->version,
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'active')
            ->assertJsonPath('data.started_by', $user->id)
            ->assertJsonPath('tracking.session_status', 'active')
            ->assertJsonPath('tracking.can_finish', false);

        $itinerary->refresh();

        $this->assertSame(Itinerary::LIFECYCLE_ACTIVE, $itinerary->lifecycle_status);
        $this->assertNotNull($itinerary->started_at);
        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('itinerary_activities', [
            'itinerary_id' => $itinerary->id,
            'action' => 'trip.started',
        ]);
    }

    public function test_a_trip_without_stops_cannot_be_started(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Add at least one stop before starting the trip.');

        $this->assertSame(Itinerary::LIFECYCLE_PLANNED, $itinerary->refresh()->lifecycle_status);
    }

    public function test_only_one_trip_can_be_ongoing_per_user(): void
    {
        $user = User::factory()->create();
        $other = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_PAUSED,
            'paused_at' => now(),
        ]);
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->for($itinerary)->create();

        $response = $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start");

        $response->assertStatus(409);
        $this->assertStringContainsString($other->title, (string) $response->json('message'));
        $this->assertSame(Itinerary::LIFECYCLE_PLANNED, $itinerary->refresh()->lifecycle_status);
    }

    public function test_a_completed_trip_cannot_be_started_again(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'completed_at' => now(),
        ]);
        ItineraryItem::factory()->for($itinerary)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertStatus(409);
    }

    public function test_a_viewer_cannot_start_a_shared_trip(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        ItineraryItem::factory()->for($itinerary)->create();
        $this->attachMember($itinerary, $viewer, Itinerary::ROLE_VIEWER);

        $this->actingAs($viewer)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertForbidden();

        $this->assertSame(Itinerary::LIFECYCLE_PLANNED, $itinerary->refresh()->lifecycle_status);
    }

    public function test_an_editor_can_start_a_shared_trip(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        ItineraryItem::factory()->for($itinerary)->create();
        $this->attachMember($itinerary, $editor, Itinerary::ROLE_EDITOR);

        $this->actingAs($editor)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'active');

        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'user_id' => $editor->id,
            'status' => 'active',
        ]);
    }

    public function test_pause_and_resume_accumulate_paused_time_and_toggle_the_session(): void
    {
        Carbon::setTestNow('2026-11-13 09:00:00');

        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/pause", [
                'base_version' => $itinerary->refresh()->version,
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'paused')
            ->assertJsonPath('tracking.session_status', 'paused');

        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'status' => 'paused',
        ]);

        Carbon::setTestNow('2026-11-13 09:10:00');

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/resume", [
                'base_version' => $itinerary->refresh()->version,
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'active')
            ->assertJsonPath('tracking.session_status', 'active');

        $itinerary->refresh();

        $this->assertNull($itinerary->paused_at);
        $this->assertSame(600, $itinerary->total_paused_seconds);
        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'status' => 'active',
        ]);
    }

    public function test_finish_completes_the_trip_and_skips_unvisited_stops(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, 2);
        $done = $itinerary->items()->first();
        $done->forceFill(['status' => 'done', 'completed_at' => now()])->save();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/stop", [
                'base_version' => $itinerary->refresh()->version,
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'completed')
            ->assertJsonPath('tracking.can_finish', true);

        $itinerary->refresh();

        $this->assertNotNull($itinerary->completed_at);
        $this->assertSame(1, $itinerary->items()->where('status', 'skipped')->count());
        $this->assertSame(1, $itinerary->items()->where('status', 'done')->count());
        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'status' => 'ended',
        ]);
        $this->assertDatabaseHas('itinerary_activities', [
            'itinerary_id' => $itinerary->id,
            'action' => 'trip.completed',
        ]);
    }

    public function test_a_planned_trip_cannot_be_paused_or_finished(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->for($itinerary)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/pause")
            ->assertStatus(409);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/stop")
            ->assertStatus(409);
    }

    public function test_a_stale_base_version_returns_conflict_payload(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create(['version' => 5]);
        ItineraryItem::factory()->for($itinerary)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start", [
                'base_version' => 4,
            ])
            ->assertStatus(409)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('data.version', 5);

        $this->assertSame(Itinerary::LIFECYCLE_PLANNED, $itinerary->refresh()->lifecycle_status);
    }

    public function test_a_cancelled_trip_cannot_be_resumed(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_CANCELLED,
        ]);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/resume")
            ->assertStatus(409);
    }

    private function startedTrip(User $user, int $stops = 1): Itinerary
    {
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->count($stops)->for($itinerary)->sequence(
            fn ($sequence) => ['order' => $sequence->index],
        )->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertOk();

        return $itinerary->refresh();
    }

    private function attachMember(Itinerary $itinerary, User $user, string $role): void
    {
        $itinerary->members()->attach($user->id, [
            'role' => $role,
            'status' => Itinerary::STATUS_ACCEPTED,
            'invited_by' => $itinerary->user_id,
            'invited_at' => now(),
            'responded_at' => now(),
            'joined_at' => now(),
        ]);
    }
}
