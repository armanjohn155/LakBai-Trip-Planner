<?php

namespace Tests\Feature;

use App\Events\FriendRequestAccepted;
use App\Events\FriendRequestDeclined;
use App\Events\FriendRequestSent;
use App\Events\Unfriended;
use App\Events\UserBlocked;
use App\Models\Friendship;
use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class FriendshipTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const GENERIC_MESSAGE = 'If that user exists, a request was sent.';

    public function test_registration_generates_a_valid_username_and_friend_code(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertCreated();

        $user = User::query()->where('email', 'jane@example.com')->firstOrFail();

        $this->assertMatchesRegularExpression('/^[a-z0-9_]{3,20}$/', $user->username);
        $this->assertMatchesRegularExpression('/^LAKBAI-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/', $user->friend_code);
        $this->assertNotNull($user->friend_code_regenerated_at);
    }

    public function test_backfill_uses_the_name_and_generates_a_friend_code(): void
    {
        $user = User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'not-the-name@example.com',
            'username' => null,
            'friend_code' => null,
        ]);

        $this->artisan('friends:backfill')->assertSuccessful();

        $user->refresh();

        $this->assertSame('maria_santos', $user->username);
        $this->assertMatchesRegularExpression('/^LAKBAI-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/', $user->friend_code);
    }

    public function test_a_user_can_send_and_accept_a_friend_request(): void
    {
        [$requester, $addressee] = User::factory()->count(2)->create();

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->username])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $friendship = Friendship::query()->firstOrFail();

        $this->assertSame('pending', $friendship->status);

        $this->actingAs($addressee)
            ->postJson("/api/friends/requests/{$friendship->id}/accept")
            ->assertOk();

        $this->assertSame('accepted', $friendship->fresh()->status);

        $this->actingAs($requester)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonPath('data.0.id', $addressee->id);

        $this->actingAs($addressee)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonPath('data.0.id', $requester->id);
    }

    public function test_two_account_walkthrough_add_by_friend_code_accept_and_block(): void
    {
        [$requester, $addressee] = User::factory()->count(2)->create();

        $this->actingAs($requester)
            ->getJson('/api/me/friend-code')
            ->assertOk()
            ->assertJsonPath('data.friend_code', $requester->friend_code);

        $this->actingAs($addressee)
            ->postJson('/api/friends/requests', ['identifier' => strtolower($requester->friend_code)])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $friendship = Friendship::query()->firstOrFail();

        $this->actingAs($requester)
            ->getJson('/api/friends/requests?direction=incoming')
            ->assertOk()
            ->assertJsonPath('data.0.user.id', $addressee->id);

        $this->actingAs($addressee)
            ->getJson('/api/friends/requests?direction=outgoing')
            ->assertOk()
            ->assertJsonPath('data.0.user.id', $requester->id);

        $this->actingAs($requester)
            ->postJson("/api/friends/requests/{$friendship->id}/accept")
            ->assertOk();

        $this->actingAs($requester)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonPath('data.0.id', $addressee->id);

        $this->actingAs($addressee)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonPath('data.0.id', $requester->id);

        $this->actingAs($addressee)
            ->postJson("/api/blocks/{$requester->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'blocked');

        $this->actingAs($requester)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($addressee)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_a_request_can_be_declined_and_an_outgoing_request_can_be_cancelled(): void
    {
        [$requester, $addressee] = User::factory()->count(2)->create();

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->friend_code])
            ->assertOk();

        $friendship = Friendship::query()->firstOrFail();

        $this->actingAs($addressee)
            ->postJson("/api/friends/requests/{$friendship->id}/decline")
            ->assertOk();

        $this->assertSame('declined', $friendship->fresh()->status);
        $this->assertNotNull($friendship->fresh()->responded_at);

        [$otherRequester, $otherAddressee] = User::factory()->count(2)->create();

        $this->actingAs($otherRequester)
            ->postJson('/api/friends/requests', ['identifier' => $otherAddressee->username])
            ->assertOk();

        $outgoing = Friendship::query()
            ->where('requester_id', $otherRequester->id)
            ->where('addressee_id', $otherAddressee->id)
            ->firstOrFail();

        $this->actingAs($otherRequester)
            ->deleteJson("/api/friends/requests/{$outgoing->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('friendships', ['id' => $outgoing->id]);
    }

    public function test_only_the_addressee_can_accept_or_decline_and_only_the_requester_can_cancel(): void
    {
        [$requester, $addressee, $stranger] = User::factory()->count(3)->create();

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->username])
            ->assertOk();

        $friendship = Friendship::query()->firstOrFail();

        $this->actingAs($requester)
            ->postJson("/api/friends/requests/{$friendship->id}/accept")
            ->assertNotFound();

        $this->actingAs($stranger)
            ->postJson("/api/friends/requests/{$friendship->id}/accept")
            ->assertNotFound();

        $this->actingAs($stranger)
            ->postJson("/api/friends/requests/{$friendship->id}/decline")
            ->assertNotFound();

        $this->actingAs($addressee)
            ->deleteJson("/api/friends/requests/{$friendship->id}")
            ->assertNotFound();

        $this->assertSame('pending', $friendship->fresh()->status);
    }

    public function test_duplicate_requests_are_ignored_and_a_reverse_request_accepts(): void
    {
        [$a, $b] = User::factory()->count(2)->create();

        $this->actingAs($a)
            ->postJson('/api/friends/requests', ['identifier' => $b->username])
            ->assertOk();

        $this->actingAs($a)
            ->postJson('/api/friends/requests', ['identifier' => $b->username])
            ->assertOk();

        $this->assertDatabaseCount('friendships', 1);
        $this->assertSame('pending', Friendship::query()->firstOrFail()->status);

        $this->actingAs($b)
            ->postJson('/api/friends/requests', ['identifier' => $a->username])
            ->assertOk();

        $this->assertDatabaseCount('friendships', 1);
        $this->assertSame('accepted', Friendship::query()->firstOrFail()->status);
    }

    public function test_self_requests_are_blocked(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/friends/requests', ['identifier' => $user->username])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $this->assertDatabaseCount('friendships', 0);
    }

    public function test_a_declined_request_can_only_be_resent_after_the_cooldown(): void
    {
        [$requester, $addressee] = User::factory()->count(2)->create();

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->username])
            ->assertOk();

        $friendship = Friendship::query()->firstOrFail();

        $this->actingAs($addressee)
            ->postJson("/api/friends/requests/{$friendship->id}/decline")
            ->assertOk();

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->username])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $this->assertSame('declined', $friendship->fresh()->status);
        $this->assertDatabaseCount('friendships', 1);

        $this->travel(8)->days();

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => $addressee->username])
            ->assertOk();

        $this->assertSame('pending', $friendship->fresh()->status);
        $this->assertNull($friendship->fresh()->responded_at);
    }

    public function test_blocking_removes_friendships_and_pending_requests(): void
    {
        [$blocker, $friend] = User::factory()->count(2)->create();
        [$pendingSender, $pendingTarget] = User::factory()->count(2)->create();

        Friendship::create([
            'requester_id' => $blocker->id,
            'addressee_id' => $friend->id,
            'status' => 'accepted',
            'responded_at' => now(),
        ]);

        Friendship::create([
            'requester_id' => $pendingSender->id,
            'addressee_id' => $pendingTarget->id,
            'status' => 'pending',
        ]);

        $this->actingAs($blocker)
            ->postJson("/api/blocks/{$friend->id}")
            ->assertOk();

        $this->assertDatabaseMissing('friendships', [
            'requester_id' => $blocker->id,
            'addressee_id' => $friend->id,
            'status' => 'accepted',
        ]);
        $this->assertDatabaseHas('friendships', [
            'requester_id' => $blocker->id,
            'addressee_id' => $friend->id,
            'status' => 'blocked',
            'blocked_by' => $blocker->id,
        ]);

        $this->actingAs($pendingSender)
            ->postJson("/api/blocks/{$pendingTarget->id}")
            ->assertOk();

        $this->assertDatabaseMissing('friendships', [
            'requester_id' => $pendingSender->id,
            'addressee_id' => $pendingTarget->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('friendships', [
            'requester_id' => $pendingSender->id,
            'addressee_id' => $pendingTarget->id,
            'status' => 'blocked',
        ]);
    }

    public function test_blocked_users_cannot_send_friend_requests_and_get_the_generic_message(): void
    {
        [$blocker, $blocked] = User::factory()->count(2)->create();

        $this->actingAs($blocker)
            ->postJson("/api/blocks/{$blocked->id}")
            ->assertOk();

        $this->actingAs($blocked)
            ->postJson('/api/friends/requests', ['identifier' => $blocker->username])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $this->assertSame(
            1,
            Friendship::query()->where('status', 'blocked')->count(),
        );
    }

    public function test_unfriending_does_not_remove_shared_trip_membership(): void
    {
        [$owner, $friend] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create();

        Friendship::create([
            'requester_id' => $owner->id,
            'addressee_id' => $friend->id,
            'status' => 'accepted',
            'responded_at' => now(),
        ]);

        $trip->members()->attach($friend->id, [
            'role' => Itinerary::ROLE_EDITOR,
            'status' => Itinerary::STATUS_ACCEPTED,
            'invited_by' => $owner->id,
            'invited_at' => now(),
            'responded_at' => now(),
            'joined_at' => now(),
        ]);

        $this->actingAs($owner)
            ->deleteJson("/api/friends/{$friend->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('friendships', [
            'requester_id' => $owner->id,
            'addressee_id' => $friend->id,
        ]);
        $this->assertDatabaseHas('itinerary_user', [
            'itinerary_id' => $trip->id,
            'user_id' => $friend->id,
            'status' => Itinerary::STATUS_ACCEPTED,
        ]);
    }

    public function test_unknown_and_partial_identifiers_do_not_create_requests(): void
    {
        $requester = User::factory()->create();
        $target = User::factory()->create(['username' => 'bobby']);

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => 'nobody@example.com'])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => 'bob'])
            ->assertOk()
            ->assertJsonPath('message', self::GENERIC_MESSAGE);

        $this->assertDatabaseCount('friendships', 0);

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => 'bobby'])
            ->assertOk();

        $this->assertDatabaseHas('friendships', [
            'requester_id' => $requester->id,
            'addressee_id' => $target->id,
            'status' => 'pending',
        ]);
    }

    public function test_friend_request_endpoint_is_rate_limited(): void
    {
        $requester = User::factory()->create();

        for ($i = 0; $i < 15; $i++) {
            $this->actingAs($requester)
                ->postJson('/api/friends/requests', ['identifier' => "missing{$i}"])
                ->assertOk();
        }

        $this->actingAs($requester)
            ->postJson('/api/friends/requests', ['identifier' => 'missing-final'])
            ->assertTooManyRequests();
    }

    public function test_friend_events_are_dispatched(): void
    {
        Event::fake();

        [$a, $b] = User::factory()->count(2)->create();
        [$c, $d] = User::factory()->count(2)->create();

        $this->actingAs($a)
            ->postJson('/api/friends/requests', ['identifier' => $b->username])
            ->assertOk();

        Event::assertDispatched(FriendRequestSent::class);

        $friendship = Friendship::query()
            ->where('requester_id', $a->id)
            ->where('addressee_id', $b->id)
            ->firstOrFail();

        $this->actingAs($b)
            ->postJson("/api/friends/requests/{$friendship->id}/accept")
            ->assertOk();

        Event::assertDispatched(FriendRequestAccepted::class);

        $this->actingAs($c)
            ->postJson('/api/friends/requests', ['identifier' => $d->username])
            ->assertOk();

        $declined = Friendship::query()
            ->where('requester_id', $c->id)
            ->where('addressee_id', $d->id)
            ->firstOrFail();

        $this->actingAs($d)
            ->postJson("/api/friends/requests/{$declined->id}/decline")
            ->assertOk();

        Event::assertDispatched(FriendRequestDeclined::class);

        $this->actingAs($a)
            ->deleteJson("/api/friends/{$b->id}")
            ->assertNoContent();

        Event::assertDispatched(Unfriended::class);

        $this->actingAs($a)
            ->postJson("/api/blocks/{$b->id}")
            ->assertOk();

        Event::assertDispatched(UserBlocked::class);
    }

    public function test_friend_resources_never_expose_emails_or_private_fields(): void
    {
        [$user, $friend] = User::factory()->count(2)->create();

        Friendship::create([
            'requester_id' => $user->id,
            'addressee_id' => $friend->id,
            'status' => 'accepted',
            'responded_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/friends')
            ->assertOk();

        $payload = $response->json('data.0');

        $this->assertArrayNotHasKey('email', $payload);
        $this->assertArrayNotHasKey('friend_code', $payload);
        $this->assertStringNotContainsString($friend->email, $response->getContent());
    }

    public function test_friends_list_does_not_trigger_n_plus_one_queries(): void
    {
        $user = User::factory()->create();

        User::factory()->count(5)->create()->each(function (User $friend) use ($user) {
            Friendship::create([
                'requester_id' => $user->id,
                'addressee_id' => $friend->id,
                'status' => 'accepted',
                'responded_at' => now(),
            ]);
        });

        DB::enableQueryLog();
        DB::flushQueryLog();

        $this->actingAs($user)
            ->getJson('/api/friends')
            ->assertOk()
            ->assertJsonCount(5, 'data');

        $this->assertLessThanOrEqual(3, count(DB::getQueryLog()));
    }

    public function test_requests_direction_must_be_incoming_or_outgoing(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/friends/requests?direction=sideways')
            ->assertUnprocessable();
    }

    public function test_friend_code_can_be_read_and_regenerated(): void
    {
        $user = User::factory()->create();
        $original = $user->friend_code;

        $this->actingAs($user)
            ->getJson('/api/me/friend-code')
            ->assertOk()
            ->assertJsonPath('data.friend_code', $original);

        $this->actingAs($user)
            ->postJson('/api/me/friend-code/regenerate')
            ->assertOk()
            ->assertJsonStructure(['data' => ['friend_code', 'friend_code_regenerated_at']]);

        $this->assertMatchesRegularExpression(
            '/^LAKBAI-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/',
            $user->fresh()->friend_code,
        );
    }
}
