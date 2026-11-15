<?php

namespace Tests\Feature;

use App\Events\MeetupPinned;
use App\Events\MemberArrived;
use App\Events\MemberLocationUpdated;
use App\Events\MemberPresenceChanged;
use App\Events\MemberSharingChanged;
use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\ItineraryMeetup;
use App\Models\TrackingPoint;
use App\Models\TrackingSession;
use App\Models\User;
use App\Notifications\MemberArrivedNotification;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GroupTrackingTest extends TestCase
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

    public function test_group_sharing_is_off_by_default_for_every_member(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $body = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->assertJsonPath('data.group', true)
            ->assertJsonPath('data.lifecycle_status', Itinerary::LIFECYCLE_ACTIVE)
            ->assertJsonPath('data.me.sharing', false)
            ->assertJsonPath('data.meetup', null)
            ->json('data');

        $this->assertNotEmpty($body['members']);

        foreach ($body['members'] as $member) {
            $this->assertFalse($member['sharing'], "{$member['name']} should not share by default");
            $this->assertNull($member['position']);
            $this->assertNull($member['online']);
        }

        // Sessions are created lazily the first time a member opts in, so the
        // only session after starting belongs to the owner and nobody shares.
        $this->assertSame(1, TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->count());

        $this->assertSame(0, TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('shared_with_group', true)
            ->count());
    }

    public function test_positions_are_only_visible_while_the_viewer_also_shares(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($viewer, $trip, true);
        $this->postPoints($viewer, $trip, 10.5, 123.5, 8);

        // The owner has not opted in, so the roster hides the viewer's position.
        $ownerView = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $viewerRow = collect($ownerView['members'])->firstWhere('user_id', $viewer->id);

        $this->assertTrue($viewerRow['sharing']);
        $this->assertNull($viewerRow['position']);
        $this->assertNull($viewerRow['online']);
        $this->assertNull($ownerView['me']['position']);

        // The viewer sees their own position because they are sharing.
        $viewerView = $this->actingAs($viewer)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $this->assertTrue($viewerView['me']['sharing']);
        $this->assertEqualsWithDelta(10.5, (float) $viewerView['me']['position']['lat'], 0.0000001);

        // Opting back in for the owner reveals the viewer's marker.
        $this->share($owner, $trip, true);

        $ownerView = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $viewerRow = collect($ownerView['members'])->firstWhere('user_id', $viewer->id);

        $this->assertNotNull($viewerRow['position']);
        $this->assertTrue($viewerRow['online']);
        $this->assertEqualsWithDelta(10.5, (float) $viewerRow['position']['lat'], 0.0000001);
    }

    public function test_toggling_off_hides_a_member_and_only_affects_that_member(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($owner, $trip, true);
        $this->share($viewer, $trip, true);
        $this->postPoints($viewer, $trip, 10.6, 123.6, 8);

        $this->assertTrue(Cache::store()->has("lakbai.tracking.group.{$trip->id}.position.{$viewer->id}"));

        $this->share($viewer, $trip, false);

        $this->assertFalse(Cache::store()->has("lakbai.tracking.group.{$trip->id}.position.{$viewer->id}"));

        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $trip->id,
            'user_id' => $viewer->id,
            'shared_with_group' => false,
        ]);

        // The owner's own sharing state is untouched.
        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $trip->id,
            'user_id' => $owner->id,
            'shared_with_group' => true,
        ]);

        $ownerView = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $viewerRow = collect($ownerView['members'])->firstWhere('user_id', $viewer->id);

        $this->assertFalse($viewerRow['sharing']);
        $this->assertNull($viewerRow['position']);
    }

    public function test_member_location_broadcast_is_throttled_to_once_per_five_seconds(): void
    {
        [, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($viewer, $trip, true);

        Event::fake([MemberLocationUpdated::class, MemberPresenceChanged::class]);

        $this->postPoints($viewer, $trip, 10.0001, 123.0001, 8, 0, 180, 5.5);
        $this->postPoints($viewer, $trip, 10.0002, 123.0002, 8);

        Event::assertDispatchedTimes(MemberLocationUpdated::class, 1);
        Event::assertDispatched(MemberLocationUpdated::class, function (MemberLocationUpdated $event) {
            $payload = $event->broadcastWith();

            return $payload['heading'] === 180 && abs($payload['speed'] - 5.5) < 0.1;
        });

        Carbon::setTestNow(Carbon::now()->addSeconds(6));

        $this->postPoints($viewer, $trip, 10.0003, 123.0003, 8);

        Event::assertDispatchedTimes(MemberLocationUpdated::class, 2);
    }

    public function test_latest_position_is_cached_while_raw_points_are_sampled(): void
    {
        [, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($viewer, $trip, true);

        $this->postPoints($viewer, $trip, 10.0001, 123.0001, 8, 0);
        $this->postPoints($viewer, $trip, 10.0002, 123.0002, 8, 4);
        $this->postPoints($viewer, $trip, 10.0003, 123.0003, 8, 8);

        $cached = Cache::store()->get("lakbai.tracking.group.{$trip->id}.position.{$viewer->id}");

        $this->assertIsArray($cached);
        $this->assertEqualsWithDelta(10.0003, (float) $cached['lat'], 0.0000001);
        $this->assertEqualsWithDelta(123.0003, (float) $cached['lng'], 0.0000001);

        // Only the first point falls inside the 10 second sampling window.
        $this->assertSame(1, TrackingPoint::query()
            ->whereIn('tracking_session_id', TrackingSession::query()
                ->where('itinerary_id', $trip->id)
                ->where('user_id', $viewer->id)
                ->pluck('id'))
            ->count());
    }

    public function test_viewers_own_roster_row_uses_the_session_position_when_cache_expires(): void
    {
        [, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($viewer, $trip, true);
        $this->postPoints($viewer, $trip, 10.0001, 123.0001, 8);
        Cache::store()->forget("lakbai.tracking.group.{$trip->id}.position.{$viewer->id}");

        $body = $this->actingAs($viewer)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $viewerRow = collect($body['members'])->firstWhere('user_id', $viewer->id);

        $this->assertTrue($viewerRow['online']);
        $this->assertEqualsWithDelta(10.0001, (float) $viewerRow['position']['lat'], 0.0000001);
        $this->assertEquals($body['me']['position'], $viewerRow['position']);
    }

    public function test_pausing_the_trip_stops_everyones_sharing_and_clears_cached_positions(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($owner, $trip, true);
        $this->share($viewer, $trip, true);
        $this->postPoints($viewer, $trip, 10.4, 123.4, 8);

        Event::fake([MemberSharingChanged::class]);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/pause")
            ->assertOk();

        $this->assertSame(0, TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('shared_with_group', true)
            ->count());

        $this->assertFalse(Cache::store()->has("lakbai.tracking.group.{$trip->id}.position.{$viewer->id}"));

        Event::assertDispatched(MemberSharingChanged::class, fn (MemberSharingChanged $event) => $event->sharing === false
            && $event->reason === 'paused');

        // The party list reports the whole group as paused, not just the actor.
        $paused = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        foreach ($paused['members'] as $member) {
            $this->assertSame(TrackingSession::STATUS_PAUSED, $member['session_status']);
        }

        // Sharing cannot be re-enabled until the trip resumes.
        $this->actingAs($viewer)
            ->patchJson("/api/itineraries/{$trip->id}/tracking/sharing", ['enabled' => true])
            ->assertStatus(409);
    }

    public function test_finishing_the_trip_clears_positions_meetups_and_sharing(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($viewer, $trip, true);
        $this->postPoints($viewer, $trip, 10.7, 123.7, 8);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/meetup", [
                'lat' => 10.7,
                'lng' => 123.7,
                'note' => 'Under the clock tower',
            ])
            ->assertCreated();

        $this->assertSame(1, ItineraryMeetup::query()->where('itinerary_id', $trip->id)->count());

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/stop")
            ->assertOk();

        $this->assertSame(0, TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('shared_with_group', true)
            ->count());

        $this->assertSame(0, ItineraryMeetup::query()->where('itinerary_id', $trip->id)->count());
        $this->assertFalse(Cache::store()->has("lakbai.tracking.group.{$trip->id}.position.{$viewer->id}"));

        $body = $this->actingAs($viewer)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $this->assertSame(Itinerary::LIFECYCLE_COMPLETED, $body['lifecycle_status']);
        $this->assertNull($body['meetup']);

        foreach ($body['members'] as $member) {
            $this->assertFalse($member['sharing']);
            $this->assertNull($member['position']);
            $this->assertSame(TrackingSession::STATUS_ENDED, $member['session_status']);
        }

        $this->actingAs($viewer)
            ->patchJson("/api/itineraries/{$trip->id}/tracking/sharing", ['enabled' => true])
            ->assertStatus(409);
    }

    public function test_meetup_pin_replaces_the_previous_pin_and_expires_after_two_hours(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        // Viewers may drop a pin even without sharing a position.
        $this->actingAs($viewer)
            ->postJson("/api/itineraries/{$trip->id}/tracking/meetup", [
                'lat' => 10.31,
                'lng' => 123.89,
                'note' => 'First pin',
            ])
            ->assertCreated()
            ->assertJsonPath('data.note', 'First pin')
            ->assertJsonPath('data.created_by', $viewer->id);

        $this->actingAs($viewer)
            ->postJson("/api/itineraries/{$trip->id}/tracking/meetup", [
                'lat' => 10.32,
                'lng' => 123.9,
                'note' => 'Second pin',
            ])
            ->assertCreated();

        $this->assertSame(1, ItineraryMeetup::query()->where('itinerary_id', $trip->id)->count());

        $meetup = ItineraryMeetup::query()->where('itinerary_id', $trip->id)->firstOrFail();

        $this->assertSame('Second pin', $meetup->note);
        $this->assertTrue($meetup->expires_at->equalTo(Carbon::now()->addMinutes(120)));

        $body = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $this->assertSame('Second pin', $body['meetup']['note']);
        $this->assertSame($viewer->name, $body['meetup']['created_by_name']);
    }

    public function test_arrival_broadcasts_and_notifies_everyone_but_the_actor(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($owner, $trip, true);
        $this->share($viewer, $trip, true);

        Event::fake([MemberArrived::class]);
        Notification::fake();

        $item = $trip->items()->firstOrFail();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/stops/{$item->id}/arrive", [
                'latitude' => 10.0,
                'longitude' => 123.0,
            ])
            ->assertOk();

        Event::assertDispatched(MemberArrived::class, fn (MemberArrived $event) => $event->member->is($owner)
            && $event->itemId === $item->id);

        Notification::assertSentTo($viewer, MemberArrivedNotification::class);
        Notification::assertNotSentTo($owner, MemberArrivedNotification::class);
    }

    public function test_complete_stop_also_broadcasts_member_arrived_if_not_already_arrived(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($owner, $trip, true);
        $this->share($viewer, $trip, true);

        Event::fake([MemberArrived::class]);
        Notification::fake();

        $item = $trip->items()->firstOrFail();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/stops/{$item->id}/complete", [
                'latitude' => 10.0,
                'longitude' => 123.0,
                'accuracy' => 10,
            ])
            ->assertOk();

        Event::assertDispatched(MemberArrived::class, fn (MemberArrived $event) => $event->member->is($owner)
            && $event->itemId === $item->id);

        Notification::assertSentTo($viewer, MemberArrivedNotification::class);
        Notification::assertNotSentTo($owner, MemberArrivedNotification::class);
    }

    public function test_group_state_includes_distance_to_next_stop_and_session_status(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($owner, $trip, true);
        $this->share($viewer, $trip, true);

        // Stop is at lat 10.0, lng 123.0. Post viewer at 10.01, 123.0 (~1112 m away).
        $this->postPoints($viewer, $trip, 10.01, 123.0, 8);

        $body = $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertOk()
            ->json('data');

        $viewerRow = collect($body['members'])->firstWhere('user_id', $viewer->id);

        $this->assertNotNull($viewerRow);
        $this->assertSame(TrackingSession::STATUS_ACTIVE, $viewerRow['session_status']);
        $this->assertNotNull($viewerRow['distance_to_next_stop_m']);
        $this->assertGreaterThan(1000, $viewerRow['distance_to_next_stop_m']);
        $this->assertLessThan(1200, $viewerRow['distance_to_next_stop_m']);
        $this->assertSame($trip->items()->firstOrFail()->id, $body['next_stop']['id']);
    }

    public function test_broadcast_payloads_never_contain_email_addresses(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        Event::fake([
            MemberArrived::class,
            MemberLocationUpdated::class,
            MemberPresenceChanged::class,
            MemberSharingChanged::class,
            MeetupPinned::class,
        ]);

        $this->share($viewer, $trip, true);
        $this->share($owner, $trip, true);
        $this->postPoints($viewer, $trip, 10.2, 123.2, 8);

        $this->actingAs($viewer)
            ->postJson("/api/itineraries/{$trip->id}/tracking/meetup", ['lat' => 10.2, 'lng' => 123.2])
            ->assertCreated();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/stops/{$trip->items()->firstOrFail()->id}/arrive")
            ->assertOk();

        $events = [
            MemberLocationUpdated::class,
            MemberPresenceChanged::class,
            MemberSharingChanged::class,
            MeetupPinned::class,
            MemberArrived::class,
        ];

        foreach ($events as $eventClass) {
            Event::assertDispatched($eventClass, function ($event) use ($owner, $viewer) {
                $payload = json_encode($event->broadcastWith(), JSON_THROW_ON_ERROR);

                $this->assertStringNotContainsString('@', $payload);
                $this->assertStringNotContainsString($owner->email, $payload);
                $this->assertStringNotContainsString($viewer->email, $payload);

                return true;
            });
        }
    }

    public function test_stale_sharing_is_stopped_and_expired_meetups_are_pruned(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($viewer, $trip, true);

        TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('user_id', $viewer->id)
            ->update([
                'started_at' => Carbon::now()->subHours(13),
                'last_point_at' => Carbon::now()->subHours(13),
            ]);

        ItineraryMeetup::query()->create([
            'itinerary_id' => $trip->id,
            'created_by' => $owner->id,
            'latitude' => 10.0,
            'longitude' => 123.0,
            'expires_at' => Carbon::now()->subMinute(),
        ]);

        $this->artisan('tracking:stop-stale-sharing')->assertSuccessful();

        $this->assertDatabaseHas('tracking_sessions', [
            'itinerary_id' => $trip->id,
            'user_id' => $viewer->id,
            'shared_with_group' => false,
        ]);

        $this->assertSame(0, ItineraryMeetup::query()->where('itinerary_id', $trip->id)->count());
    }

    public function test_presence_sweep_marks_members_offline_after_sixty_seconds(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $this->share($owner, $trip, true);
        $this->share($viewer, $trip, true);
        $this->postPoints($viewer, $trip, 10.2, 123.2, 8);

        Carbon::setTestNow(Carbon::now()->addSeconds(61));

        Event::fake([MemberPresenceChanged::class]);

        $this->artisan('tracking:sweep-presence')->assertSuccessful();

        Event::assertDispatched(MemberPresenceChanged::class, fn (MemberPresenceChanged $event) => $event->member->is($viewer)
            && $event->online === false);
    }

    public function test_non_members_cannot_read_group_state_and_solo_trips_are_rejected(): void
    {
        [$owner, , $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $outsider = User::factory()->create();

        $this->actingAs($outsider)
            ->getJson("/api/itineraries/{$trip->id}/tracking/group")
            ->assertNotFound();

        $solo = Itinerary::factory()->for($owner)->create(['trip_type' => Itinerary::TRIP_SOLO]);

        $this->actingAs($owner)
            ->getJson("/api/itineraries/{$solo->id}/tracking/group")
            ->assertNotFound();

        $this->actingAs($owner)
            ->patchJson("/api/itineraries/{$solo->id}/tracking/sharing", ['enabled' => true])
            ->assertStatus(422);
    }

    public function test_private_channel_authorization_matrix(): void
    {
        [$owner, $viewer, $trip] = $this->activeGroupTrip(Itinerary::ROLE_VIEWER);

        $editor = User::factory()->create();
        $pending = User::factory()->create();
        $outsider = User::factory()->create();

        $this->addMember($trip, $editor, Itinerary::ROLE_EDITOR, Itinerary::STATUS_ACCEPTED);
        $this->addMember($trip, $pending, Itinerary::ROLE_VIEWER, Itinerary::STATUS_PENDING);

        $this->share($owner, $trip, true);
        $this->share($editor, $trip, true);
        $this->share($viewer, $trip, true);

        // Start the matrix with the accepted viewer opted out.
        TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('user_id', $viewer->id)
            ->update(['shared_with_group' => false]);

        $this->enableRealBroadcasting();

        $this->assertChannelAuth($owner, $trip, 200);
        $this->assertChannelAuth($editor, $trip, 200);

        // Accepted member who has not opted in yet.
        $this->assertChannelAuth($viewer, $trip, 403);

        // An accepted viewer may subscribe once they opt in.
        TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('user_id', $viewer->id)
            ->update(['shared_with_group' => true]);

        $this->assertChannelAuth($viewer, $trip, 200);

        // Opting out revokes the channel for that traveller only.
        TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('user_id', $owner->id)
            ->update(['shared_with_group' => false]);

        $this->assertChannelAuth($owner, $trip, 403);
        $this->assertChannelAuth($editor, $trip, 200);

        // Pending invite and total outsider are indistinguishable from a
        // non-existent trip.
        $this->assertChannelAuth($pending, $trip, 404);
        $this->assertChannelAuth($outsider, $trip, 404);

        // An ended session revokes access even when the trip is still active.
        TrackingSession::query()
            ->where('itinerary_id', $trip->id)
            ->where('user_id', $editor->id)
            ->update(['status' => TrackingSession::STATUS_ENDED, 'ended_at' => Carbon::now()]);

        $this->assertChannelAuth($editor, $trip, 403);

        // A paused (or completed) trip closes the channel even for a member
        // who is still flagged as sharing.
        $trip->forceFill(['lifecycle_status' => Itinerary::LIFECYCLE_PAUSED])->save();

        $this->assertChannelAuth($viewer, $trip, 403);
    }

    /**
     * @return array{0: User, 1: User, 2: Itinerary}
     */
    private function activeGroupTrip(string $memberRole): array
    {
        $owner = User::factory()->create(['name' => 'Owner Traveller']);
        $member = User::factory()->create(['name' => 'Member Traveller']);

        $trip = Itinerary::factory()->for($owner)->create([
            'title' => 'Group Trip',
            'trip_type' => Itinerary::TRIP_GROUP,
            'lifecycle_status' => Itinerary::LIFECYCLE_PLANNED,
        ]);

        $destination = Destination::factory()->create([
            'name' => 'Test Stop',
            'latitude' => 10.0,
            'longitude' => 123.0,
            'radius_m' => 150,
        ]);

        ItineraryItem::factory()->for($trip)->for($destination)->create(['order' => 0]);

        $this->addMember($trip, $member, $memberRole);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/tracking/start")
            ->assertOk();

        return [$owner, $member, $trip->refresh()];
    }

    private function addMember(
        Itinerary $trip,
        User $user,
        string $role = Itinerary::ROLE_VIEWER,
        string $status = Itinerary::STATUS_ACCEPTED,
    ): void {
        $trip->members()->attach($user->id, [
            'role' => $role,
            'status' => $status,
            'invited_by' => $trip->user_id,
            'invited_at' => Carbon::now(),
            'responded_at' => $status === Itinerary::STATUS_ACCEPTED ? Carbon::now() : null,
            'joined_at' => $status === Itinerary::STATUS_ACCEPTED ? Carbon::now() : null,
        ]);

        $trip->unsetRelation('members');
    }

    private function share(User $user, Itinerary $trip, bool $enabled): void
    {
        $this->actingAs($user)
            ->patchJson("/api/itineraries/{$trip->id}/tracking/sharing", ['enabled' => $enabled])
            ->assertOk();
    }

    private function postPoints(
        User $user,
        Itinerary $trip,
        float $lat,
        float $lng,
        int $accuracy,
        int $offsetSeconds = 0,
        ?int $heading = null,
        ?float $speed = null,
    ): void {
        $point = [
            'lat' => $lat,
            'lng' => $lng,
            'accuracy' => $accuracy,
            'recorded_at' => Carbon::now()->addSeconds($offsetSeconds)->toIso8601String(),
        ];

        if ($heading !== null) {
            $point['heading'] = $heading;
        }

        if ($speed !== null) {
            $point['speed'] = $speed;
        }

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$trip->id}/tracking/points", [
                'points' => [$point],
            ])
            ->assertOk();
    }

    private function enableRealBroadcasting(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb' => [
                'driver' => 'reverb',
                'key' => 'test-key',
                'secret' => 'test-secret',
                'app_id' => 'test-app',
                'options' => [
                    'host' => '127.0.0.1',
                    'port' => 6001,
                    'scheme' => 'http',
                    'useTLS' => false,
                ],
            ],
        ]);

        $manager = app(BroadcastManager::class);
        $manager->forgetDrivers();

        require base_path('routes/channels.php');
    }

    private function assertChannelAuth(User $user, Itinerary $trip, int $status): void
    {
        Sanctum::actingAs($user);

        $this->postJson('/api/broadcasting/auth', [
            'channel_name' => "private-itinerary.{$trip->id}.tracking",
            'socket_id' => '1234.5678',
        ])->assertStatus($status);
    }
}
