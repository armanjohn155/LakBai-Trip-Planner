<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TripPhoto;
use App\Models\TripRecap;
use App\Models\User;
use App\Models\Visit;
use App\Services\TripRecapBuilder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TripRecapTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-11-14 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_finishing_a_trip_builds_stats_and_a_simplified_route(): void
    {
        $owner = User::factory()->create();
        $destination = Destination::factory()->create([
            'name' => 'Kawasan Falls',
            'latitude' => 9.8,
            'longitude' => 123.2,
            'municipality' => 'Badian',
            'category' => 'Waterfall',
        ]);

        $trip = Itinerary::factory()->for($owner)->create([
            'start_date' => '2026-11-14',
            'end_date' => '2026-11-14',
        ]);

        $stop = ItineraryItem::factory()->for($trip)->for($destination)->create([
            'status' => 'planned',
            'estimated_budget' => 500,
            'order' => 0,
        ]);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/start")
            ->assertOk();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/points", [
                'points' => [
                    $this->point(10.0, 123.0, 0),
                    $this->point(10.001, 123.0, -30),
                    $this->point(10.002, 123.0, -60),
                    $this->point(10.003, 123.0, -90),
                    $this->point(10.004, 123.0, -120),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.accepted', 5);

        $stop->forceFill([
            'status' => 'done',
            'visited' => true,
            'completed_at' => Carbon::now(),
        ])->save();

        Visit::factory()->create([
            'user_id' => $owner->id,
            'destination_id' => $destination->id,
            'itinerary_stop_id' => $stop->id,
            'verified' => true,
        ]);

        $stop->forceFill(['visit_id' => Visit::query()->latest('id')->value('id')])->save();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/stop", [
                'base_version' => $trip->refresh()->version,
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'completed');

        $recap = TripRecap::query()->where('itinerary_id', $trip->id)->firstOrFail();

        $this->assertNotNull($recap->stats);
        $this->assertGreaterThan(300, $recap->stats['distance_m']);
        $this->assertSame(1, $recap->stats['stops_visited']);
        $this->assertSame(1, $recap->stats['verified_visits']);
        $this->assertEqualsWithDelta(500.0, $recap->stats['spend_planned'], 0.01);
        $this->assertEqualsWithDelta(500.0, $recap->stats['spend_estimated'], 0.01);
        $this->assertNotEmpty($recap->route_geojson['features']);
        $this->assertSame('LineString', $recap->route_geojson['features'][0]['geometry']['type']);

        $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/recap")
            ->assertOk()
            ->assertJsonPath('data.title', $trip->title)
            ->assertJsonPath('data.stops.0.title', 'Kawasan Falls')
            ->assertJsonPath('data.stops.0.verified', true)
            ->assertJsonPath('data.permissions.can_edit', true)
            ->assertJsonPath('data.stats.stops_total', 1);
    }

    public function test_share_tokens_are_hashed_shown_once_and_revocable(): void
    {
        $owner = User::factory()->create();
        $trip = $this->completedTrip($owner);

        $response = $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/recap/share-link", [
                'expires_in_days' => 7,
            ])
            ->assertCreated();

        $token = $response->json('data.token');

        $this->assertIsString($token);
        $this->assertSame(64, strlen($token));
        $this->assertStringContainsString('/s/'.$token, $response->json('data.url'));

        $recap = TripRecap::query()->where('itinerary_id', $trip->id)->firstOrFail();

        $this->assertSame(hash('sha256', $token), $recap->share_token_hash);
        $this->assertNotSame($token, $recap->share_token_hash);
        $this->assertFalse(DB::table('trip_recaps')->where('share_token_hash', $token)->exists());
        $this->assertNotNull($recap->share_expires_at);

        $this->getJson('/api/shared/recaps/'.$token)->assertOk();

        $this->actingAs($owner)
            ->deleteJson("/api/itineraries/{$trip->id}/recap/share-link")
            ->assertNoContent();

        $this->getJson('/api/shared/recaps/'.$token)->assertNotFound();
        $this->assertNull($recap->refresh()->share_token_hash);
    }

    public function test_share_tokens_expire_and_only_link_or_public_visibility_resolves(): void
    {
        $owner = User::factory()->create();
        $trip = $this->completedTrip($owner);
        $recap = $this->recapFor($trip);

        $token = 'visibility-token';
        $hash = hash('sha256', $token);

        $cases = [
            TripRecap::VISIBILITY_PRIVATE => 404,
            TripRecap::VISIBILITY_MEMBERS => 404,
            TripRecap::VISIBILITY_LINK => 200,
            TripRecap::VISIBILITY_PUBLIC => 200,
        ];

        foreach ($cases as $visibility => $status) {
            $recap->forceFill([
                'visibility' => $visibility,
                'share_token_hash' => $hash,
                'share_expires_at' => Carbon::now()->addDay(),
            ])->save();

            $this->getJson('/api/shared/recaps/'.$token)->assertStatus($status);
        }

        $recap->forceFill([
            'visibility' => TripRecap::VISIBILITY_LINK,
            'share_expires_at' => Carbon::now()->subMinute(),
        ])->save();

        $this->getJson('/api/shared/recaps/'.$token)->assertNotFound();
    }

    public function test_recap_design_is_owner_only_and_cover_photo_must_belong_to_the_trip(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $trip = $this->completedTrip($owner);
        $this->attachMember($trip, $editor, Itinerary::ROLE_EDITOR);

        $this->actingAs($editor)
            ->putJson("/api/itineraries/{$trip->id}/recap", ['title' => 'Hijacked'])
            ->assertForbidden();

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/recap", [
                'title' => 'Our Badian weekend',
                'summary' => 'Waterfalls, long walks and too much lechon.',
                'hide_endpoints' => false,
                'show_stats' => false,
                'show_photos' => false,
                'theme_accent' => 'mango',
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Our Badian weekend')
            ->assertJsonPath('data.theme_accent', 'mango')
            ->assertJsonPath('data.hide_endpoints', false);

        $otherTrip = $this->completedTrip(User::factory()->create());
        $foreignPhoto = $this->photo($otherTrip, $owner);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/recap", [
                'cover_photo_id' => $foreignPhoto->id,
            ])
            ->assertStatus(422);

        $ownPhoto = $this->photo($trip, $owner);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/recap", [
                'cover_photo_id' => $ownPhoto->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.cover_photo_id', $ownPhoto->id);
    }

    public function test_completed_trip_is_read_only_except_for_stop_notes(): void
    {
        $owner = User::factory()->create();
        $trip = $this->completedTrip($owner);
        $stop = $trip->items()->firstOrFail();

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}", ['title' => 'Renamed'])
            ->assertStatus(409);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/items", [
                'custom_title' => 'Sneaky stop',
                'custom_latitude' => 10,
                'custom_longitude' => 123,
            ])
            ->assertStatus(409);

        $this->actingAs($owner)
            ->deleteJson("/api/itineraries/{$trip->id}/items/{$stop->id}")
            ->assertStatus(409);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/items/reorder", [
                'stops' => [['id' => $stop->id, 'day_number' => 1, 'order' => 1]],
            ])
            ->assertStatus(409);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/items/{$stop->id}", [
                'estimated_budget' => 1,
            ])
            ->assertStatus(409);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/items/{$stop->id}", [
                'notes' => 'The path was slippery after the rain.',
            ])
            ->assertOk();

        $this->assertSame('The path was slippery after the rain.', $stop->refresh()->notes);
    }

    public function test_plan_this_again_duplicates_without_members_and_resets_the_lifecycle(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $trip = $this->completedTrip($owner);
        $this->attachMember($trip, $member, Itinerary::ROLE_VIEWER);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.lifecycle_status', 'planned')
            ->assertJsonPath('data.trip_type', 'solo')
            ->assertJsonPath('data.member_count', 0)
            ->assertJsonCount(1, 'data.items');

        $copy = Itinerary::query()->latest('id')->firstOrFail();

        $this->assertSame(Itinerary::LIFECYCLE_PLANNED, $copy->lifecycle_status);
        $this->assertNull($copy->started_at);
        $this->assertNull($copy->completed_at);
        $this->assertSame(0, $copy->distance_m);
        $this->assertSame(0, $copy->members()->count());
        $this->assertSame(1, $copy->items()->count());
    }

    public function test_rebuild_command_recomputes_the_stored_route(): void
    {
        $owner = User::factory()->create();
        $trip = $this->completedTrip($owner);
        $recap = $this->recapFor($trip);

        $recap->forceFill(['route_geojson' => ['type' => 'FeatureCollection', 'features' => []]])->save();

        $this->artisan('trips:rebuild-recap', ['itinerary' => $trip->id])
            ->assertExitCode(0);

        $this->assertNotEmpty($recap->refresh()->route_geojson['features']);
    }

    private function completedTrip(User $owner): Itinerary
    {
        $destination = Destination::factory()->create([
            'name' => 'Osmeña Peak '.uniqid(),
            'latitude' => 9.8,
            'longitude' => 123.4,
            'municipality' => 'Dalaguete',
            'category' => 'Mountains & Hiking',
            'image_url' => '/storage/destinations/osmena.jpg',
        ]);

        $trip = Itinerary::factory()->for($owner)->create([
            'title' => 'Osmeña Peak weekend',
            'start_date' => '2026-11-14',
            'end_date' => '2026-11-15',
            'lifecycle_status' => Itinerary::LIFECYCLE_COMPLETED,
            'started_at' => Carbon::now()->subHours(6),
            'completed_at' => Carbon::now(),
            'distance_m' => 1200,
            'moving_seconds' => 3600,
            'total_paused_seconds' => 0,
        ]);

        ItineraryItem::factory()->for($trip)->for($destination)->create([
            'day_number' => 1,
            'order' => 0,
            'status' => 'done',
            'visited' => true,
            'estimated_budget' => 350,
            'notes' => 'Private trail note that must never be public.',
            'completed_at' => Carbon::now()->subHour(),
        ]);

        $session = $trip->trackingSessions()->create([
            'user_id' => $owner->id,
            'status' => 'ended',
            'started_at' => Carbon::now()->subHours(6),
            'ended_at' => Carbon::now(),
            'distance_m' => 1200,
        ]);

        foreach (range(0, 8) as $index) {
            $session->points()->create([
                'lat' => 10.0 + ($index * 0.001),
                'lng' => 123.0,
                'accuracy_m' => 10,
                'recorded_at' => Carbon::now()->subHours(6)->addMinutes($index * 10),
            ]);
        }

        app(TripRecapBuilder::class)->build($trip);

        return $trip->refresh();
    }

    private function recapFor(Itinerary $trip): TripRecap
    {
        return TripRecap::query()->where('itinerary_id', $trip->id)->firstOrFail();
    }

    private function photo(Itinerary $trip, User $user): TripPhoto
    {
        return TripPhoto::query()->create([
            'itinerary_id' => $trip->id,
            'user_id' => $user->id,
            'path' => 'recap-photos/'.$trip->id.'/cover.jpg',
            'caption' => 'Cover',
            'position' => 1,
            'is_hidden' => false,
        ]);
    }

    private function attachMember(Itinerary $trip, User $user, string $role): void
    {
        $trip->members()->attach($user->id, [
            'role' => $role,
            'status' => Itinerary::STATUS_ACCEPTED,
            'invited_by' => $trip->user_id,
            'invited_at' => now(),
            'responded_at' => now(),
            'joined_at' => now(),
        ]);
    }

    /**
     * @return array{lat: float, lng: float, accuracy: int, recorded_at: string}
     */
    private function point(float $lat, float $lng, int $offsetSeconds): array
    {
        return [
            'lat' => $lat,
            'lng' => $lng,
            'accuracy' => 10,
            'recorded_at' => Carbon::now()->addSeconds($offsetSeconds)->toIso8601String(),
        ];
    }
}
