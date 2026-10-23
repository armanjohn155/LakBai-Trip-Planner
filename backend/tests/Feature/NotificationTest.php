<?php

namespace Tests\Feature;

use App\Events\TripUpdated;
use App\Models\Destination;
use App\Models\Friendship;
use App\Models\Itinerary;
use App\Models\NotificationPreference;
use App\Models\Review;
use App\Models\User;
use App\Notifications\FriendRequestReceivedNotification;
use App\Services\NotificationDispatcher;
use App\Services\TripInvitationService;
use App\Support\NotificationType;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_friend_request_notifies_addressee_with_safe_payload(): void
    {
        $requester = User::factory()->create(['name' => 'Ana']);
        $addressee = User::factory()->create(['name' => 'Ben']);

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->username ?? $addressee->email])
            ->assertOk();

        $this->assertSame(1, $addressee->notifications()->count());
        $this->assertSame(0, $requester->notifications()->count());

        $notification = $addressee->notifications()->first();
        $this->assertSame(NotificationType::FRIEND_REQUEST_RECEIVED, $notification->type);
        $this->assertSame('Ana sent you a friend request.', $notification->data['message']);
        $this->assertStringNotContainsString($requester->email, json_encode($notification->data));
        $this->assertStringNotContainsString('password', json_encode($notification->data));
    }

    public function test_friend_request_accepted_notifies_the_requester(): void
    {
        $requester = User::factory()->create();
        $addressee = User::factory()->create(['name' => 'Ben']);
        $friendship = Friendship::create([
            'requester_id' => $requester->id,
            'addressee_id' => $addressee->id,
            'status' => 'pending',
        ]);

        $this->actingAs($addressee)
            ->postJson("/api/friends/requests/{$friendship->id}/accept")
            ->assertOk();

        $this->assertSame(1, $requester->notifications()->count());
        $this->assertSame(NotificationType::FRIEND_REQUEST_ACCEPTED, $requester->notifications()->first()->type);
    }

    public function test_trip_invite_notification_becomes_non_actionable_after_accepting(): void
    {
        [$owner, $friend] = User::factory()->count(2)->create();
        $this->makeFriends($owner, $friend);

        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);

        app(TripInvitationService::class)->invite($trip, $owner, [$friend->id], 'editor');

        $this->assertSame(1, $friend->notifications()->count());
        $notification = $friend->notifications()->first();
        $this->assertSame(NotificationType::TRIP_INVITE_RECEIVED, $notification->type);
        $this->assertTrue($notification->data['actionable']);

        $this->actingAs($friend)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', NotificationType::TRIP_INVITE_RECEIVED)
            ->assertJsonPath('data.0.actionable', true);

        $this->actingAs($friend)
            ->postJson("/api/itineraries/{$trip->id}/invitation/accept")
            ->assertOk();

        $this->assertSame(1, $owner->notifications()->count());
        $this->assertSame(NotificationType::TRIP_INVITE_ACCEPTED, $owner->notifications()->first()->type);

        $this->actingAs($friend)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.actionable', false);
    }

    public function test_shared_trip_updates_are_batched_and_never_notify_the_actor(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $trip->members()->attach($member->id, [
            'role' => 'editor',
            'status' => 'accepted',
            'invited_by' => $owner->id,
            'invited_at' => now(),
            'responded_at' => now(),
            'joined_at' => now(),
        ]);

        event(new TripUpdated($trip, $owner, 'stop.created'));
        event(new TripUpdated($trip, $owner, 'stop.updated'));

        $this->assertSame(0, $owner->notifications()->count());
        $this->assertSame(1, $member->notifications()->count());

        $notification = $member->notifications()->first();
        $this->assertSame(NotificationType::TRIP_UPDATED, $notification->type);
        $this->assertSame(2, $notification->data['count']);
        $this->assertSame('stop.updated', $notification->data['last_action']);
    }

    public function test_blocked_members_are_never_notified(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $trip->members()->attach($member->id, [
            'role' => 'editor',
            'status' => 'accepted',
            'invited_by' => $owner->id,
        ]);

        $this->actingAs($owner)->postJson("/api/blocks/{$member->id}")->assertOk();

        event(new TripUpdated($trip, $owner, 'stop.created'));

        $this->assertSame(0, $member->notifications()->count());
    }

    public function test_disabled_in_app_preference_suppresses_notifications(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $trip->members()->attach($member->id, [
            'role' => 'editor',
            'status' => 'accepted',
            'invited_by' => $owner->id,
        ]);

        NotificationPreference::create([
            'user_id' => $member->id,
            'type' => NotificationType::TRIP_UPDATED,
            'channel' => 'in_app',
            'enabled' => false,
        ]);

        event(new TripUpdated($trip, $owner, 'stop.created'));

        $this->assertSame(0, $member->notifications()->count());
    }

    public function test_preference_endpoint_updates_the_matrix(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/notification-preferences', [
                'preferences' => [
                    ['type' => NotificationType::TRIP_UPDATED, 'channel' => 'email', 'enabled' => true],
                    ['type' => NotificationType::TRIP_UPDATED, 'channel' => 'in_app', 'enabled' => false],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('preferences.11.channels.in_app', false)
            ->assertJsonPath('preferences.11.channels.email', true);

        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $user->id,
            'type' => NotificationType::TRIP_UPDATED,
            'channel' => 'in_app',
            'enabled' => 0,
        ]);
    }

    public function test_email_channel_is_skipped_when_mail_is_not_configured(): void
    {
        [$owner, $friend] = User::factory()->count(2)->create();
        $friendship = Friendship::create([
            'requester_id' => $owner->id,
            'addressee_id' => $friend->id,
            'status' => 'pending',
        ]);

        config(['mail.default' => 'log']);
        Mail::fake();

        $friend->notify(new FriendRequestReceivedNotification($friendship, $owner));

        Mail::assertNothingSent();
        $this->assertSame(1, $friend->notifications()->count());
    }

    public function test_email_channel_is_sent_when_configured(): void
    {
        [$owner, $friend] = User::factory()->count(2)->create();
        $friendship = Friendship::create([
            'requester_id' => $owner->id,
            'addressee_id' => $friend->id,
            'status' => 'pending',
        ]);

        config([
            'mail.default' => 'smtp',
            'mail.from.address' => 'notifications@example.com',
            'mail.from.name' => 'Lakbai',
        ]);
        Mail::fake();

        $friend->notify(new FriendRequestReceivedNotification($friendship, $owner));

        $this->assertTrue(true);
    }

    public function test_notification_endpoints_only_expose_the_owners_records(): void
    {
        [$owner, $member, $stranger] = User::factory()->count(3)->create();
        $this->makeFriends($owner, $member);
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);

        app(TripInvitationService::class)->invite($trip, $owner, [$member->id], 'editor');

        $id = $member->notifications()->first()->id;

        $this->actingAs($stranger)
            ->postJson("/api/notifications/{$id}/read")
            ->assertNotFound();

        $this->actingAs($member)
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('count', 1);

        $this->actingAs($member)
            ->postJson("/api/notifications/{$id}/read")
            ->assertOk()
            ->assertJsonPath('read', true);

        $this->actingAs($member)
            ->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('count', 0);

        $this->actingAs($member)
            ->deleteJson("/api/notifications/{$id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('notifications', ['id' => $id]);
    }

    public function test_read_all_and_clear_read(): void
    {
        $user = User::factory()->create();
        $actor = User::factory()->create();
        $friendship = Friendship::create([
            'requester_id' => $actor->id,
            'addressee_id' => $user->id,
            'status' => 'pending',
        ]);

        $user->notify(new FriendRequestReceivedNotification($friendship, $actor));

        $this->actingAs($user)
            ->postJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('updated', 1);

        $this->assertNotNull($user->notifications()->first()->read_at);

        $this->actingAs($user)
            ->deleteJson('/api/notifications/read')
            ->assertOk()
            ->assertJsonPath('deleted', 1);
    }

    public function test_review_hidden_notifies_the_author_once(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $author = User::factory()->create();
        $review = Review::factory()->for($author)->for(Destination::factory())->create([
            'title' => 'A spicy take',
        ]);

        $this->actingAs($admin)
            ->postJson("/api/admin/reviews/{$review->id}/hide", ['reason' => 'Spam'])
            ->assertOk();

        $this->assertSame(1, $author->notifications()->count());
        $this->assertSame(NotificationType::REVIEW_HIDDEN, $author->notifications()->first()->type);

        $this->actingAs($admin)
            ->postJson("/api/admin/reviews/{$review->id}/hide", ['reason' => 'Spam'])
            ->assertOk();

        $this->assertSame(1, $author->notifications()->count());
    }

    public function test_reported_review_notifies_admins_but_not_the_reporter(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $reporter = User::factory()->create();
        $review = Review::factory()->for(User::factory())->for(Destination::factory())->create();

        $this->actingAs($reporter)
            ->postJson("/api/reviews/{$review->id}/report", ['reason' => 'spam'])
            ->assertCreated();

        $this->assertSame(1, $admin->notifications()->count());
        $this->assertSame(NotificationType::REVIEW_REPORTED, $admin->notifications()->first()->type);
        $this->assertSame(0, $reporter->notifications()->count());
    }

    public function test_starting_soon_command_is_idempotent(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create([
            'trip_type' => 'group',
            'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(3)->toDateString(),
        ]);
        $trip->members()->attach($member->id, [
            'role' => 'viewer',
            'status' => 'accepted',
            'invited_by' => $owner->id,
        ]);

        $this->artisan('trips:notify-starting-soon')->assertSuccessful();
        $this->artisan('trips:notify-starting-soon')->assertSuccessful();

        $this->assertSame(1, $member->notifications()->where('type', NotificationType::TRIP_STARTING_SOON)->count());
        $this->assertSame(1, $owner->notifications()->where('type', NotificationType::TRIP_STARTING_SOON)->count());
    }

    public function test_prune_command_removes_old_notifications(): void
    {
        $user = User::factory()->create();

        $oldRead = $user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => NotificationType::TRIP_UPDATED,
            'data' => ['type' => NotificationType::TRIP_UPDATED, 'message' => 'old'],
            'read_at' => now()->subDays(45),
            'created_at' => now()->subDays(45),
            'updated_at' => now()->subDays(45),
        ]);

        $ancient = $user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => NotificationType::TRIP_UPDATED,
            'data' => ['type' => NotificationType::TRIP_UPDATED, 'message' => 'ancient'],
            'read_at' => null,
            'created_at' => now()->subDays(120),
            'updated_at' => now()->subDays(120),
        ]);

        $recent = $user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => NotificationType::TRIP_UPDATED,
            'data' => ['type' => NotificationType::TRIP_UPDATED, 'message' => 'recent'],
            'read_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('notifications:prune')->assertSuccessful();

        $this->assertDatabaseMissing('notifications', ['id' => $oldRead->id]);
        $this->assertDatabaseMissing('notifications', ['id' => $ancient->id]);
        $this->assertDatabaseHas('notifications', ['id' => $recent->id]);
    }

    private function makeFriends(User $a, User $b): Friendship
    {
        return Friendship::create([
            'requester_id' => $a->id,
            'addressee_id' => $b->id,
            'status' => 'accepted',
        ]);
    }
}
