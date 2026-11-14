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
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TripTrackingTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_summary_reports_session_position_and_next_stop(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                'points' => [
                    $this->point(10.0, 123.0, 12, 0),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.accepted', 1)
            ->assertJsonPath('data.rejected', 0);

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/tracking")
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'active')
            ->assertJsonPath('data.session_status', 'active')
            ->assertJsonPath('data.next_stop.title', 'Test Stop')
            ->assertJsonPath('data.can_finish', false);

        $summary = $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/tracking")
            ->json('data');

        $this->assertEqualsWithDelta(10.0, (float) $summary['last_position']['lat'], 0.0000001);
        $this->assertEqualsWithDelta(123.0, (float) $summary['last_position']['lng'], 0.0000001);
    }

    public function test_points_are_filtered_for_accuracy_age_future_jitter_gaps_and_jumps(): void
    {
        Carbon::setTestNow('2026-11-13 10:00:00');

        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        $response = $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                'points' => [
                    // Accepted: base position.
                    $this->point(10.0, 123.0, 10, -600),
                    // Rejected: accuracy worse than 100 m.
                    $this->point(10.0, 123.0, 200, -595),
                    // Rejected: older than 10 minutes.
                    $this->point(10.0, 123.0, 10, -601),
                    // Rejected: timestamped too far into the future.
                    $this->point(10.0, 123.0, 10, 120),
                    // Accepted: gap is over 5 minutes, so no distance accumulates.
                    $this->point(10.001, 123.0, 10, -290),
                    // Accepted: ~111 m from the previous point, inside the gap limit.
                    $this->point(10.002, 123.0, 10, -280),
                    // Accepted: ~0 m of movement; jitter adds no distance.
                    $this->point(10.002, 123.0, 10, -270),
                    // Rejected: impossible jump (about 11 km in 5 seconds).
                    $this->point(10.1, 123.0, 10, -265),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.accepted', 4)
            ->assertJsonPath('data.rejected', 4);

        $distance = (int) $response->json('data.distance_m');
        $this->assertGreaterThan(100, $distance);
        $this->assertLessThan(125, $distance);

        $itinerary->refresh();

        $this->assertSame($distance, $itinerary->distance_m);
        $this->assertGreaterThan(0, $itinerary->moving_seconds);
        $this->assertSame(4, TrackingPoint::query()->count());

        $session = TrackingSession::query()->where('itinerary_id', $itinerary->id)->firstOrFail();
        $this->assertEqualsWithDelta(10.002, (float) $session->last_lat, 0.0000001);
        $this->assertEqualsWithDelta(123.0, (float) $session->last_lng, 0.0000001);
    }

    public function test_a_paused_trip_rejects_new_points(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/pause")
            ->assertOk();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                'points' => [$this->point(10.0, 123.0, 10, 0)],
            ])
            ->assertStatus(409)
            ->assertJsonPath('accepted', 0);
    }

    public function test_a_planned_trip_rejects_new_points(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->for($itinerary)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                'points' => [$this->point(10.0, 123.0, 10, 0)],
            ])
            ->assertStatus(409);
    }

    public function test_bare_point_arrays_are_accepted(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                $this->point(10.0, 123.0, 10, 0),
            ])
            ->assertOk()
            ->assertJsonPath('data.accepted', 1);
    }

    public function test_batches_are_capped_at_fifty_points(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        $points = [];
        for ($index = 0; $index < 51; $index++) {
            $points[] = $this->point(10.0, 123.0, 10, 0);
        }

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                'points' => $points,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('points');
    }

    public function test_points_require_authentication(): void
    {
        $itinerary = Itinerary::factory()->create();
        ItineraryItem::factory()->for($itinerary)->create();

        $this->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
            'points' => [$this->point(10.0, 123.0, 10, 0)],
        ])->assertUnauthorized();
    }

    public function test_points_are_throttled_after_thirty_requests_per_minute(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        for ($attempt = 0; $attempt < 30; $attempt++) {
            $this->actingAs($user)
                ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                    'points' => [$this->point(10.0, 123.0, 10, 0)],
                ])
                ->assertOk();
        }

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/points", [
                'points' => [$this->point(10.0, 123.0, 10, 0)],
            ])
            ->assertStatus(429);
    }

    public function test_summary_query_count_does_not_grow_with_stops(): void
    {
        $user = User::factory()->create();
        $itinerary = $this->startedTrip($user);

        DB::enableQueryLog();
        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/tracking")
            ->assertOk();
        $baseline = count(DB::getQueryLog());
        DB::flushQueryLog();

        foreach (range(1, 4) as $index) {
            ItineraryItem::factory()->for($itinerary)->create(['order' => $index]);
        }

        DB::flushQueryLog();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/tracking")
            ->assertOk();
        $withFiveStops = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertSame($baseline, $withFiveStops);
    }

    private function startedTrip(User $user): Itinerary
    {
        $destination = Destination::factory()->create([
            'name' => 'Test Stop',
            'latitude' => 10.0,
            'longitude' => 123.0,
            'radius_m' => 150,
        ]);

        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->for($itinerary)->for($destination)->create([
            'order' => 0,
        ]);

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/tracking/start")
            ->assertOk();

        $itinerary = $itinerary->refresh();

        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $itinerary->id,
            'user_id' => $user->id,
            'status' => TrackingSession::STATUS_ACTIVE,
        ]);

        return $itinerary;
    }

    /**
     * @return array{lat: float, lng: float, accuracy: int, recorded_at: string}
     */
    private function point(float $lat, float $lng, int $accuracy, int $offsetSeconds): array
    {
        return [
            'lat' => $lat,
            'lng' => $lng,
            'accuracy' => $accuracy,
            'recorded_at' => Carbon::now()->addSeconds($offsetSeconds)->toIso8601String(),
        ];
    }
}
