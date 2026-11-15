<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TripPhoto;
use App\Models\TripRecap;
use App\Models\User;
use App\Services\RouteSimplifier;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SharedRecapTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const TOKEN = 'public-recap-token-1234567890';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-11-15 10:00:00');
        config([
            'lakbai.recap.privacy_radius_m' => 300,
            'lakbai.recap.public_base_url' => 'https://lakbai.test',
            'lakbai.recap.app_url' => 'https://app.lakbai.test',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_public_recap_exposes_only_whitelisted_fields(): void
    {
        [$owner, $trip, $recap] = $this->sharedTrip();

        $response = $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk();

        $data = $response->json('data');
        $json = $response->getContent();

        $this->assertSame(['title', 'summary', 'start_date', 'end_date', 'day_count', 'theme_accent', 'hide_endpoints', 'cover_photo', 'stats', 'route', 'stops', 'photos'], array_keys($data));

        // No member identities, emails, roles, notes or budgets.
        $this->assertArrayNotHasKey('members', $data);
        $this->assertArrayNotHasKey('permissions', $data);
        $this->assertArrayNotHasKey('share', $data);
        $this->assertArrayNotHasKey('member_count', $data);
        $this->assertArrayNotHasKey('travellers', $data['stats']);

        $this->assertStringNotContainsString($owner->email, $json);
        $this->assertStringNotContainsString('Private Friend', $json);
        $this->assertStringNotContainsString('Private trail note', $json);
        $this->assertStringNotContainsString('spend_planned', $json);
        $this->assertStringNotContainsString('spend_estimated', $json);
        $this->assertStringNotContainsString('estimated_budget', $json);
        $this->assertStringNotContainsString('email', $json);

        foreach ($data['photos'] as $photo) {
            $this->assertArrayNotHasKey('user', $photo);
            $this->assertArrayNotHasKey('itinerary_id', $photo);
            $this->assertArrayNotHasKey('path', $photo);
        }

        foreach ($data['stops'] as $stop) {
            $this->assertArrayNotHasKey('notes', $stop);
            $this->assertArrayNotHasKey('destination_id', $stop);
            $this->assertArrayNotHasKey('estimated_budget', $stop);
        }

        $this->assertArrayNotHasKey('spend_planned', $data['stats']);
        $this->assertArrayNotHasKey('spend_estimated', $data['stats']);
    }

    public function test_public_route_is_trimmed_at_both_ends_and_custom_stop_coordinates_stay_private(): void
    {
        [$owner, $trip, $recap] = $this->sharedTrip();

        $stored = $recap->route_geojson['features'][0]['geometry']['coordinates'];
        $data = $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk()->json('data');

        $published = $data['route']['features'][0]['geometry']['coordinates'];

        $this->assertGreaterThanOrEqual(2, count($published));
        $this->assertNotEquals($stored[0], $published[0]);
        $this->assertNotEquals($stored[count($stored) - 1], $published[count($published) - 1]);

        $geometry = app(RouteSimplifier::class);
        $startGap = $geometry->haversineMeters(
            (float) $stored[0][1], (float) $stored[0][0],
            (float) $published[0][1], (float) $published[0][0],
        );
        $endGap = $geometry->haversineMeters(
            (float) $stored[count($stored) - 1][1], (float) $stored[count($stored) - 1][0],
            (float) $published[count($published) - 1][1], (float) $published[count($published) - 1][0],
        );

        $this->assertGreaterThan(200, $startGap);
        $this->assertGreaterThan(200, $endGap);

        $custom = collect($data['stops'])->firstWhere('title', 'Home base');
        $this->assertNotNull($custom);
        $this->assertNull($custom['latitude']);
        $this->assertNull($custom['longitude']);

        $destinationStop = collect($data['stops'])->firstWhere('title', 'Kawasan Falls');
        $this->assertNotNull($destinationStop);
        $this->assertEqualsWithDelta(9.8, $destinationStop['latitude'], 0.0001);
        $this->assertEqualsWithDelta(123.2, $destinationStop['longitude'], 0.0001);

        // Turning the privacy flag off publishes the stored route untouched.
        $recap->forceFill(['hide_endpoints' => false])->save();

        $untrimmed = $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk()->json('data');
        $this->assertSame($stored, $untrimmed['route']['features'][0]['geometry']['coordinates']);
    }

    public function test_design_toggles_hide_stats_photos_and_hidden_cover(): void
    {
        [$owner, $trip, $recap] = $this->sharedTrip();

        $recap->forceFill(['show_stats' => false])->save();
        $data = $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk()->json('data');
        $this->assertNull($data['stats']);

        $recap->forceFill(['show_stats' => true, 'show_photos' => false])->save();
        $data = $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk()->json('data');
        $this->assertSame([], $data['photos']);
        $this->assertNull($data['cover_photo']);

        // Even as a cover, a hidden photo must never surface publicly.
        $hidden = TripPhoto::query()
            ->where('itinerary_id', $trip->id)
            ->where('is_hidden', true)
            ->firstOrFail();

        $recap->forceFill([
            'show_photos' => true,
            'cover_photo_id' => $hidden->id,
        ])->save();

        $data = $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk()->json('data');
        $this->assertNotNull($data['cover_photo']);
        $this->assertNotSame($hidden->id, $data['cover_photo']['id']);
        $this->assertNotContains($hidden->id, array_column($data['photos'], 'id'));
    }

    public function test_invalid_expired_and_revoked_links_all_return_not_found(): void
    {
        [$owner, $trip, $recap] = $this->sharedTrip();

        $this->getJson('/api/shared/recaps/not-a-real-token')->assertNotFound();

        $recap->forceFill(['share_expires_at' => Carbon::now()->subMinute()])->save();
        $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertNotFound();
        $this->get('/s/'.self::TOKEN)->assertNotFound();

        $recap->forceFill([
            'visibility' => TripRecap::VISIBILITY_MEMBERS,
            'share_expires_at' => Carbon::now()->addDay(),
        ])->save();
        $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertNotFound();

        $recap->forceFill([
            'visibility' => TripRecap::VISIBILITY_LINK,
            'share_token_hash' => null,
        ])->save();
        $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertNotFound();
    }

    public function test_public_endpoint_is_rate_limited(): void
    {
        [$owner, $trip] = $this->sharedTrip();

        for ($attempt = 1; $attempt <= 30; $attempt++) {
            $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertOk();
        }

        $this->getJson('/api/shared/recaps/'.self::TOKEN)->assertStatus(429);
    }

    public function test_open_graph_page_renders_meta_and_redirects_to_the_spa(): void
    {
        [$owner, $trip] = $this->sharedTrip();

        $response = $this->get('/s/'.self::TOKEN)->assertOk();

        $response->assertSee('og:title', false);
        $response->assertSee('og:image', false);
        $response->assertSee('https://app.lakbai.test/s/'.self::TOKEN, false);
        $response->assertSee('https://lakbai.test/s/'.self::TOKEN, false);
        $response->assertDontSee('Private Friend');
        $response->assertDontSee('Private trail note');
        $response->assertDontSee($owner->email);
    }

    public function test_open_graph_page_hides_invalid_links_from_crawlers(): void
    {
        $response = $this->get('/s/unknown-token')->assertNotFound();

        $response->assertSee('noindex', false);
        $response->assertSee('invalid or has expired');
    }

    /**
     * @return array{0: User, 1: Itinerary, 2: TripRecap}
     */
    private function sharedTrip(): array
    {
        $owner = User::factory()->create([
            'name' => 'Recap Owner',
            'email' => 'recap-owner@example.test',
        ]);

        $member = User::factory()->create(['name' => 'Private Friend']);

        $trip = Itinerary::factory()->for($owner)->create([
            'title' => 'Badian waterfall weekend',
            'start_date' => '2026-11-14',
            'end_date' => '2026-11-15',
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'started_at' => Carbon::now()->subHours(8),
            'completed_at' => Carbon::now(),
            'distance_m' => 1600,
            'moving_seconds' => 5400,
            'total_paused_seconds' => 0,
        ]);

        $trip->members()->attach($member->id, [
            'role' => Itinerary::ROLE_VIEWER,
            'status' => Itinerary::STATUS_ACCEPTED,
            'invited_by' => $owner->id,
            'invited_at' => now(),
            'responded_at' => now(),
            'joined_at' => now(),
        ]);

        $destination = Destination::factory()->create([
            'name' => 'Kawasan Falls',
            'latitude' => 9.8,
            'longitude' => 123.2,
            'municipality' => 'Badian',
            'category' => 'Waterfall',
            'image_url' => '/storage/destinations/kawasan.jpg',
        ]);

        ItineraryItem::factory()->for($trip)->for($destination)->create([
            'day_number' => 1,
            'order' => 0,
            'status' => 'done',
            'visited' => true,
            'estimated_budget' => 450,
            'notes' => 'Private trail note that must never be public.',
        ]);

        ItineraryItem::factory()->for($trip)->create([
            'day_number' => 1,
            'order' => 1,
            'destination_id' => null,
            'custom_title' => 'Home base',
            'custom_latitude' => 10.3456,
            'custom_longitude' => 123.4567,
            'status' => 'skipped',
        ]);

        $visible = TripPhoto::query()->create([
            'itinerary_id' => $trip->id,
            'user_id' => $owner->id,
            'path' => 'recap-photos/'.$trip->id.'/visible.jpg',
            'caption' => 'Morning mist',
            'position' => 1,
            'is_hidden' => false,
        ]);

        TripPhoto::query()->create([
            'itinerary_id' => $trip->id,
            'user_id' => $owner->id,
            'path' => 'recap-photos/'.$trip->id.'/hidden.jpg',
            'caption' => 'Do not publish',
            'position' => 2,
            'is_hidden' => true,
        ]);

        $coordinates = [];

        foreach (range(0, 14) as $index) {
            // 15 points, roughly 1.5 km long: enough to trim 300 m per end.
            $coordinates[] = [round(123.0 + ($index * 0.0001), 7), round(10.0 + ($index * 0.001), 7)];
        }

        $recap = TripRecap::query()->create([
            'itinerary_id' => $trip->id,
            'title' => 'Our Badian weekend',
            'summary' => 'Waterfalls, long walks and too much lechon.',
            'cover_photo_id' => $visible->id,
            'visibility' => TripRecap::VISIBILITY_LINK,
            'share_token_hash' => hash('sha256', self::TOKEN),
            'share_expires_at' => Carbon::now()->addDays(30),
            'hide_endpoints' => true,
            'show_stats' => true,
            'show_photos' => true,
            'theme_accent' => 'sea',
            'route_geojson' => [
                'type' => 'FeatureCollection',
                'features' => [[
                    'type' => 'Feature',
                    'properties' => ['day' => 1, 'sequence' => 1, 'point_count' => count($coordinates)],
                    'geometry' => ['type' => 'LineString', 'coordinates' => $coordinates],
                ]],
            ],
            'stats' => [
                'distance_m' => 1600,
                'moving_seconds' => 5400,
                'elapsed_seconds' => 7200,
                'days' => 2,
                'stops_total' => 2,
                'stops_visited' => 1,
                'stops_skipped' => 1,
                'verified_visits' => 1,
                'spend_planned' => 450.0,
                'spend_estimated' => 450.0,
                'average_speed_kmh' => 1.1,
                'travellers' => 1,
            ],
        ]);

        return [$owner, $trip->refresh(), $recap->refresh()];
    }
}
