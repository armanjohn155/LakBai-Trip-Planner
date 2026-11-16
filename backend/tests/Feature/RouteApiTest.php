<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RouteApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['lakbai.routing.enabled' => true, 'lakbai.routing.provider' => 'osrm']);
    }

    public function test_returns_geojson_route_and_caches_repeat_requests(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['router.project-osrm.org/*' => Http::response([
            'code' => 'Ok',
            'routes' => [[
                'distance' => 2400,
                'duration' => 300,
                'geometry' => ['type' => 'LineString', 'coordinates' => [[123.0, 10.0], [123.02, 10.02]]],
                'legs' => [['distance' => 2400, 'duration' => 300]],
            ]],
        ])]);
        $body = ['waypoints' => [['lat' => 10, 'lng' => 123], ['lat' => 10.02, 'lng' => 123.02]]];

        $first = $this->postJson('/api/routes', $body)->assertOk()
            ->assertJsonPath('data.geometry.type', 'LineString')
            ->assertJsonPath('data.geometry.coordinates.0.0', 123.0)
            ->assertJsonPath('data.distance_m', 2400)
            ->assertJsonPath('data.approximate', false);
        $this->postJson('/api/routes', $body)->assertOk()->assertExactJson($first->json());
        Http::assertSentCount(1);
    }

    public function test_no_route_returns_an_approximate_straight_line(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['router.project-osrm.org/*' => Http::response(['code' => 'NoRoute'])]);

        $this->postJson('/api/routes', ['waypoints' => [
            ['lat' => 10.0, 'lng' => 123.0], ['lat' => 11.0, 'lng' => 124.0],
        ]])->assertOk()
            ->assertJsonPath('data.approximate', true)
            ->assertJsonPath('data.reason', 'no_road_route')
            ->assertJsonPath('data.geometry.type', 'LineString');
    }

    public function test_provider_timeout_falls_back_without_failing_the_request(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(fn () => throw new ConnectionException('routing request timed out'));

        $this->postJson('/api/routes', ['waypoints' => [
            ['lat' => 10.0, 'lng' => 123.0], ['lat' => 10.01, 'lng' => 123.01],
        ]])->assertOk()
            ->assertJsonPath('data.approximate', true)
            ->assertJsonPath('data.reason', 'provider_unavailable');
    }

    public function test_route_endpoint_is_public_and_validates_waypoints(): void
    {
        Http::fake(['router.project-osrm.org/*' => Http::response(['code' => 'NoRoute'])]);
        $payload = ['waypoints' => [['lat' => 10, 'lng' => 123], ['lat' => 11, 'lng' => 124]]];
        $this->postJson('/api/routes', $payload)->assertOk();

        $this->postJson('/api/routes', ['waypoints' => [
            ['lat' => 91, 'lng' => 123], ['lat' => 10, 'lng' => 124],
        ]])->assertUnprocessable();
        $this->postJson('/api/routes', ['waypoints' => array_fill(0, 26, ['lat' => 10, 'lng' => 123])])
            ->assertUnprocessable();
    }

    public function test_openrouteservice_key_is_not_returned_to_the_client(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['lakbai.routing.provider' => 'openrouteservice', 'lakbai.routing.ors_api_key' => 'private-test-key']);
        Http::fake(['api.openrouteservice.org/*' => Http::response([
            'features' => [[
                'geometry' => ['type' => 'LineString', 'coordinates' => [[123, 10], [123.01, 10.01]]],
                'properties' => ['summary' => ['distance' => 1000, 'duration' => 120], 'segments' => [['distance' => 1000, 'duration' => 120]]],
            ]],
        ])]);

        $response = $this->postJson('/api/routes', ['waypoints' => [
            ['lat' => 10, 'lng' => 123], ['lat' => 10.01, 'lng' => 123.01],
        ]])->assertOk();
        $this->assertStringNotContainsString('private-test-key', $response->getContent());
        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'private-test-key'));
    }

    public function test_route_endpoint_is_throttled(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['router.project-osrm.org/*' => Http::response([
            'code' => 'NoRoute',
        ])]);
        $payload = ['waypoints' => [['lat' => 10, 'lng' => 123], ['lat' => 10.01, 'lng' => 123.01]]];

        for ($request = 0; $request < 30; $request++) {
            $this->postJson('/api/routes', $payload)->assertOk();
        }
        $this->postJson('/api/routes', $payload)->assertTooManyRequests();
    }
}
