<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TrackingPoint;
use App\Models\TrackingSession;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TripRescheduleAndExpiryTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_shift_moves_only_remaining_stops_and_bumps_the_version_once(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, 2);
        [$done, $remaining] = $itinerary->items()->orderBy('order')->get()->all();

        $done->forceFill(['status' => 'done', 'start_time' => '08:00', 'completed_at' => now()])->save();
        $remaining->forceFill(['start_time' => '09:00'])->save();

        $version = $itinerary->refresh()->version;

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/lifecycle/reschedule", [
                'strategy' => 'shift',
                'minutes' => 30,
                'base_version' => $version,
            ])
            ->assertOk()
            ->assertJsonPath('data.version', $version + 1);

        $this->assertSame('08:00', $done->refresh()->start_time);
        $this->assertSame('09:30', $remaining->refresh()->start_time);
        $this->assertSame($version + 1, $itinerary->refresh()->version);
    }

    public function test_move_day_places_remaining_stops_after_existing_stops_on_the_target_day(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, 2);
        [$done, $remaining] = $itinerary->items()->orderBy('order')->get()->all();

        $done->forceFill(['status' => 'done', 'day_number' => 1, 'order' => 0])->save();
        $remaining->forceFill(['day_number' => 1, 'order' => 1])->save();

        ItineraryItem::factory()->for($itinerary)->for(Destination::factory())->create([
            'status' => 'done',
            'day_number' => 3,
            'order' => 0,
        ]);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/lifecycle/reschedule", [
                'strategy' => 'move_day',
                'day_number' => 3,
            ])
            ->assertOk();

        $remaining->refresh();

        $this->assertSame(3, $remaining->day_number);
        $this->assertSame(1, $remaining->order);
        $this->assertSame(1, $done->refresh()->day_number);
    }

    public function test_reschedule_requires_remaining_stops(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, 1);
        $itinerary->items()->update(['status' => 'done', 'completed_at' => now()]);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/lifecycle/reschedule", [
                'strategy' => 'shift',
                'minutes' => 30,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'There are no remaining stops to reschedule.');
    }

    public function test_a_finished_trip_cannot_be_rescheduled(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, 1);
        $itinerary->forceFill([
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'completed_at' => now(),
        ])->save();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/lifecycle/reschedule", [
                'strategy' => 'shift',
                'minutes' => 30,
            ])
            ->assertStatus(409);
    }

    public function test_cancel_marks_remaining_stops_skipped_and_ends_the_session(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user, 2);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/lifecycle/cancel")
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'cancelled');

        $this->assertSame(2, $itinerary->items()->where('status', 'skipped')->count());
        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'status' => 'ended',
        ]);
    }

    public function test_expire_stale_pauses_abandoned_active_trips_and_cancels_long_paused_trips(): void
    {
        Carbon::setTestNow('2026-11-13 12:00:00');

        $user = User::factory()->create();

        $staleActive = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_ACTIVE,
            'started_at' => now()->subHours(30),
            'started_by' => $user->id,
        ]);
        TrackingSession::query()->create([
            'itinerary_id' => $staleActive->id,
            'user_id' => $user->id,
            'status' => TrackingSession::STATUS_ACTIVE,
            'started_at' => now()->subHours(30),
        ]);

        $freshActive = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_ACTIVE,
            'started_at' => now()->subHours(30),
            'started_by' => $user->id,
        ]);
        TrackingSession::query()->create([
            'itinerary_id' => $freshActive->id,
            'user_id' => $user->id,
            'status' => TrackingSession::STATUS_ACTIVE,
            'started_at' => now()->subHours(30),
            'last_point_at' => now()->subHour(),
        ]);

        $oldPaused = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_PAUSED,
            'started_at' => now()->subDays(9),
            'paused_at' => now()->subDays(8),
        ]);
        $pausedSession = TrackingSession::query()->create([
            'itinerary_id' => $oldPaused->id,
            'user_id' => $user->id,
            'status' => TrackingSession::STATUS_PAUSED,
            'started_at' => now()->subDays(9),
        ]);

        $this->artisan('trips:expire-stale')->assertExitCode(0);

        $this->assertSame(Itinerary::LIFECYCLE_PAUSED, $staleActive->refresh()->lifecycle_status);
        $this->assertNotNull($staleActive->paused_at);
        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $staleActive->id,
            'status' => 'paused',
        ]);

        $this->assertSame(Itinerary::LIFECYCLE_ACTIVE, $freshActive->refresh()->lifecycle_status);

        $this->assertSame(Itinerary::LIFECYCLE_CANCELLED, $oldPaused->refresh()->lifecycle_status);
        $this->assertSame(TrackingSession::STATUS_ENDED, $pausedSession->refresh()->status);
    }

    public function test_prune_deletes_only_old_points_for_finished_trips(): void
    {
        Carbon::setTestNow('2026-11-13 12:00:00');

        $user = User::factory()->create();

        $oldTrip = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'completed_at' => now()->subDays(100),
        ]);
        $oldSession = TrackingSession::query()->create([
            'itinerary_id' => $oldTrip->id,
            'user_id' => $user->id,
            'status' => TrackingSession::STATUS_ENDED,
            'started_at' => now()->subDays(101),
            'ended_at' => now()->subDays(100),
        ]);
        $oldPoint = $this->point($oldSession, now()->subDays(100));

        $recentTrip = Itinerary::factory()->for($user)->create([
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'completed_at' => now()->subDays(10),
        ]);
        $recentSession = TrackingSession::query()->create([
            'itinerary_id' => $recentTrip->id,
            'user_id' => $user->id,
            'status' => TrackingSession::STATUS_ENDED,
            'started_at' => now()->subDays(11),
            'ended_at' => now()->subDays(10),
        ]);
        $recentPoint = $this->point($recentSession, now()->subDays(10));

        $this->artisan('tracking:prune')->assertExitCode(0);

        $this->assertDatabaseMissing('tracking_points', ['id' => $oldPoint->id]);
        $this->assertDatabaseHas('tracking_points', ['id' => $recentPoint->id]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function startedTrip(User $user, int $stops = 1, array $attributes = []): Itinerary
    {
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->count($stops)->for($itinerary)->sequence(
            fn ($sequence) => ['order' => $sequence->index],
        )->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertOk();

        $itinerary = $itinerary->refresh();

        if ($attributes !== []) {
            $itinerary->forceFill($attributes)->saveQuietly();
        }

        return $itinerary;
    }

    private function point(TrackingSession $session, Carbon $recordedAt): TrackingPoint
    {
        return TrackingPoint::query()->create([
            'tracking_session_id' => $session->id,
            'lat' => 10.0,
            'lng' => 123.0,
            'accuracy_m' => 10,
            'recorded_at' => $recordedAt,
        ]);
    }
}
