<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class VisitControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_guests_cannot_check_in(): void
    {
        $destination = Destination::factory()->create();

        $this->postJson("/api/destinations/{$destination->id}/check-in", [
            'latitude' => 10.0,
            'longitude' => 123.0,
            'accuracy' => 10,
        ])->assertUnauthorized();
    }

    public function test_user_can_check_in_when_within_radius(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
            'radius_m' => 150,
        ]);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/check-in", [
                'latitude' => 10.0005,
                'longitude' => 123.0,
                'accuracy' => 15,
            ])
            ->assertCreated()
            ->assertJsonPath('data.verified', true)
            ->assertJsonPath('data.method', 'gps');

        $this->assertDatabaseHas('visits', [
            'user_id' => $user->id,
            'destination_id' => $destination->id,
            'verified' => true,
        ]);
    }

    public function test_check_in_fails_when_too_far(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
            'radius_m' => 100,
        ]);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/check-in", [
                'latitude' => 10.1,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'distance');

        $this->assertDatabaseCount('visits', 0);
    }

    public function test_check_in_during_cooldown_returns_429(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
        ]);

        Visit::factory()->verified()->create([
            'user_id' => $user->id,
            'destination_id' => $destination->id,
            'visited_at' => now()->subHour(),
        ]);

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/check-in", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertStatus(429)
            ->assertJsonPath('reason', 'cooldown');
    }

    public function test_user_can_record_a_manual_visit(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/destinations/{$destination->id}/visits/manual", [
                'visited_at' => now()->subDays(3)->toDateString(),
                'notes' => 'Took a jeep from the terminal.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.verified', false)
            ->assertJsonPath('data.method', 'manual');
    }

    public function test_history_is_owner_scoped_and_paginated(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        Visit::factory()->count(2)->create(['user_id' => $user->id]);
        Visit::factory()->create(['user_id' => $other->id]);

        $this->actingAs($user)
            ->getJson('/api/visits')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_stats_summarise_user_visits(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create(['region' => 'South Cebu']);

        Visit::factory()->verified()->create(['user_id' => $user->id, 'destination_id' => $destination->id]);
        Visit::factory()->create(['user_id' => $user->id, 'destination_id' => $destination->id]);

        $this->actingAs($user)
            ->getJson('/api/visits/stats')
            ->assertOk()
            ->assertJsonPath('data.total_visits', 2)
            ->assertJsonPath('data.verified_visits', 1)
            ->assertJsonPath('data.unique_destinations', 1);
    }

    public function test_map_endpoint_groups_by_destination(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create(['latitude' => 10.5, 'longitude' => 123.5]);

        Visit::factory()->verified()->create(['user_id' => $user->id, 'destination_id' => $destination->id]);
        Visit::factory()->create(['user_id' => $user->id, 'destination_id' => $destination->id]);

        $this->actingAs($user)
            ->getJson('/api/visits/map')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.destination_id', $destination->id)
            ->assertJsonPath('data.0.visit_count', 2)
            ->assertJsonPath('data.0.verified', true);
    }

    public function test_user_can_delete_their_own_visit(): void
    {
        $user = User::factory()->create();
        $visit = Visit::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->deleteJson("/api/visits/{$visit->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('visits', ['id' => $visit->id]);
    }

    public function test_user_cannot_delete_someone_elses_visit(): void
    {
        $user = User::factory()->create();
        $visit = Visit::factory()->create();

        $this->actingAs($user)
            ->deleteJson("/api/visits/{$visit->id}")
            ->assertForbidden();
    }

    public function test_destination_shows_user_visit_status(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->getJson("/api/destinations/{$destination->id}")
            ->assertOk()
            ->assertJsonPath('data.user_visit_status', 'none');

        Visit::factory()->create(['user_id' => $user->id, 'destination_id' => $destination->id]);

        $this->actingAs($user)
            ->getJson("/api/destinations/{$destination->id}")
            ->assertOk()
            ->assertJsonPath('data.user_visit_status', 'manual');

        Visit::factory()->verified()->create(['user_id' => $user->id, 'destination_id' => $destination->id]);

        $this->actingAs($user)
            ->getJson("/api/destinations/{$destination->id}")
            ->assertOk()
            ->assertJsonPath('data.user_visit_status', 'verified');
    }
}
