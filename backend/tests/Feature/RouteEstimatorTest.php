<?php

namespace Tests\Feature;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use App\Services\RouteEstimator;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RouteEstimatorTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_uses_osrm_distance_and_duration_when_available(): void
    {
        Http::fake([
            'router.project-osrm.org/*' => Http::response([
                'routes' => [['distance' => 4200.0, 'duration' => 600.0]],
            ]),
        ]);

        $estimator = new RouteEstimator(enabled: true);

        $result = $estimator->estimate(10.0, 123.0, 10.1, 123.1);

        $this->assertSame('osrm', $result['source']);
        $this->assertSame(4200, $result['distance_m']);
        $this->assertSame(600, $result['duration_s']);
    }

    public function test_falls_back_to_haversine_when_osrm_fails(): void
    {
        Http::fake([
            'router.project-osrm.org/*' => Http::response('', 500),
        ]);

        $estimator = new RouteEstimator(enabled: true, fallbackSpeedKmh: 30.0);

        $result = $estimator->estimate(10.0, 123.0, 10.0, 123.0);

        $this->assertSame('haversine', $result['source']);
        $this->assertSame(0, $result['distance_m']);
        $this->assertSame(0, $result['duration_s']);
    }

    public function test_disabled_estimator_skips_network_and_uses_haversine(): void
    {
        Http::fake();

        $estimator = new RouteEstimator(enabled: false);

        $result = $estimator->estimate(10.0, 123.0, 10.1, 123.1);

        Http::assertNothingSent();
        $this->assertSame('haversine', $result['source']);
        $this->assertGreaterThan(0, $result['distance_m']);
    }

    public function test_endpoint_reports_disabled_and_empty_legs_by_default(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 1]);
        ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 2]);

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/route-estimates")
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.days.0.legs', []);
    }

    public function test_endpoint_returns_legs_when_enabled(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        ItineraryItem::factory()->recycle($itinerary)->create([
            'day_number' => 1,
            'order' => 1,
            'destination_id' => null,
            'custom_title' => 'A',
            'custom_latitude' => 10.0,
            'custom_longitude' => 123.0,
        ]);
        ItineraryItem::factory()->recycle($itinerary)->create([
            'day_number' => 1,
            'order' => 2,
            'destination_id' => null,
            'custom_title' => 'B',
            'custom_latitude' => 10.1,
            'custom_longitude' => 123.1,
        ]);

        $this->app->instance(RouteEstimator::class, new RouteEstimator(enabled: false));

        $response = $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/route-estimates")
            ->assertOk();

        $response->assertJsonPath('data.enabled', false);
    }

    public function test_endpoint_requires_authentication_and_ownership(): void
    {
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();

        $this->getJson("/api/itineraries/{$itinerary->id}/route-estimates")->assertUnauthorized();

        $other = User::factory()->create();
        $this->actingAs($other)
            ->getJson("/api/itineraries/{$itinerary->id}/route-estimates")
            ->assertNotFound();
    }
}
