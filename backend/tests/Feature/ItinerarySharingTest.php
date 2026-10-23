<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItinerarySharingTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_owner_can_invite_an_accepted_friend_and_pending_invitee_sees_only_a_preview(): void
    {
        [$owner, $friend] = User::factory()->count(2)->create();
        $this->makeFriends($owner, $friend);

        $trip = Itinerary::factory()->for($owner)->create([
            'title' => 'Secret Group Trip',
            'description' => 'Private notes',
            'trip_type' => 'group',
        ]);
        ItineraryItem::factory()->for($trip)->create(['notes' => 'Private stop note']);

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/members", [
                'user_ids' => [$friend->id],
                'role' => 'editor',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('itinerary_user', [
            'itinerary_id' => $trip->id,
            'user_id' => $friend->id,
            'role' => 'editor',
            'status' => 'pending',
        ]);

        $this->actingAs($friend)
            ->getJson('/api/itineraries?filter=invited')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Secret Group Trip')
            ->assertJsonPath('data.0.my_status', 'pending')
            ->assertJsonPath('data.0.my_role', null)
            ->assertJsonPath('data.0.invited_role', 'editor')
            ->assertJsonMissingPath('data.0.items')
            ->assertJsonMissingPath('data.0.description')
            ->assertJsonMissingPath('data.0.start_date')
            ->assertJsonMissingPath('data.0.budget');

        $this->actingAs($friend)
            ->getJson("/api/itineraries/{$trip->id}")
            ->assertNotFound();

        $this->actingAs($friend)
            ->getJson("/api/itineraries/{$trip->id}/members")
            ->assertNotFound();
    }

    public function test_accepting_an_invitation_grants_access_and_flips_trip_to_group(): void
    {
        [$owner, $friend] = User::factory()->count(2)->create();
        $this->makeFriends($owner, $friend);

        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'solo']);
        $this->actingAs($owner)->postJson("/api/itineraries/{$trip->id}/members", [
            'user_ids' => [$friend->id],
            'role' => 'viewer',
        ])->assertCreated();

        $this->assertSame('solo', $trip->fresh()->trip_type);

        $this->actingAs($friend)
            ->getJson("/api/itineraries/{$trip->id}/invitation")
            ->assertOk()
            ->assertJsonPath('data.title', $trip->title)
            ->assertJsonPath('data.role', 'viewer')
            ->assertJsonMissingPath('data.items');

        $this->actingAs($friend)
            ->postJson("/api/itineraries/{$trip->id}/invitation/accept")
            ->assertOk();

        $this->assertSame('group', $trip->fresh()->trip_type);

        $this->actingAs($friend)
            ->getJson('/api/itineraries?filter=shared')
            ->assertOk()
            ->assertJsonPath('data.0.id', $trip->id)
            ->assertJsonPath('data.0.my_role', 'viewer');
    }

    public function test_only_accepted_friends_can_be_invited_and_only_by_the_owner(): void
    {
        [$owner, $friend, $stranger, $editor] = User::factory()->count(4)->create();
        $this->makeFriends($owner, $friend);
        $trip = Itinerary::factory()->for($owner)->create();
        $this->attachMember($trip, $editor, 'editor');

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/members", [
                'user_ids' => [$stranger->id],
                'role' => 'viewer',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user_ids');

        $this->actingAs($owner)->postJson("/api/blocks/{$friend->id}")->assertOk();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/members", [
                'user_ids' => [$friend->id],
                'role' => 'viewer',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user_ids');

        $this->actingAs($editor)
            ->postJson("/api/itineraries/{$trip->id}/members", [
                'user_ids' => [$friend->id],
                'role' => 'viewer',
            ])
            ->assertForbidden();
    }

    public function test_member_limits_count_accepted_and_pending_collaborators(): void
    {
        config(['lakbai.sharing.max_members' => 2]);
        [$owner, $a, $b, $c] = User::factory()->count(4)->create();
        $this->makeFriends($owner, $a);
        $this->makeFriends($owner, $b);
        $this->makeFriends($owner, $c);
        $trip = Itinerary::factory()->for($owner)->create();

        $this->actingAs($owner)->postJson("/api/itineraries/{$trip->id}/members", [
            'user_ids' => [$a->id, $b->id],
            'role' => 'viewer',
        ])->assertCreated();

        $this->actingAs($owner)->postJson("/api/itineraries/{$trip->id}/members", [
            'user_ids' => [$c->id],
            'role' => 'viewer',
        ])->assertUnprocessable();
    }

    public function test_removing_the_last_member_returns_the_trip_to_solo(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $this->attachMember($trip, $member, 'editor');

        $this->actingAs($owner)
            ->deleteJson("/api/itineraries/{$trip->id}/members/{$member->id}")
            ->assertNoContent();

        $this->assertSame('solo', $trip->fresh()->trip_type);
    }

    public function test_viewer_can_read_export_and_duplicate_but_cannot_edit_or_manage_members(): void
    {
        [$owner, $viewer] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $item = ItineraryItem::factory()->for($trip)->create();
        $this->attachMember($trip, $viewer, 'viewer');

        $this->actingAs($viewer)->getJson("/api/itineraries/{$trip->id}")->assertOk();
        $this->actingAs($viewer)->putJson("/api/itineraries/{$trip->id}", ['title' => 'Hacked'])->assertForbidden();
        $this->actingAs($viewer)->postJson("/api/itineraries/{$trip->id}/items", [
            'custom_title' => 'Injected stop',
            'custom_latitude' => 10.3,
            'custom_longitude' => 123.9,
        ])->assertForbidden();
        $this->actingAs($viewer)->putJson("/api/itineraries/{$trip->id}/items/{$item->id}", [
            'notes' => 'Changed',
        ])->assertForbidden();
        $this->actingAs($viewer)->deleteJson("/api/itineraries/{$trip->id}/items/{$item->id}")->assertForbidden();
        $this->actingAs($viewer)->postJson("/api/itineraries/{$trip->id}/members", [
            'user_ids' => [$owner->id],
            'role' => 'editor',
        ])->assertForbidden();

        $this->actingAs($viewer)
            ->postJson("/api/itineraries/{$trip->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.my_role', 'owner')
            ->assertJsonPath('data.member_count', 0);

        $copy = Itinerary::query()->where('title', 'Copy of '.$trip->title)->firstOrFail();
        $this->assertSame($viewer->id, $copy->user_id);
        $this->assertDatabaseMissing('itinerary_user', ['itinerary_id' => $copy->id]);
    }

    public function test_editor_can_edit_but_cannot_manage_members(): void
    {
        [$owner, $editor] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $this->attachMember($trip, $editor, 'editor');

        $this->actingAs($editor)
            ->putJson("/api/itineraries/{$trip->id}", ['title' => 'Editor title'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Editor title');

        $this->actingAs($editor)
            ->postJson("/api/itineraries/{$trip->id}/members", [
                'user_ids' => [$owner->id],
                'role' => 'viewer',
            ])
            ->assertForbidden();
    }

    public function test_non_members_get_404_for_every_private_trip_endpoint(): void
    {
        [$owner, $stranger] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create();
        $item = ItineraryItem::factory()->for($trip)->create();

        $this->actingAs($stranger)->getJson("/api/itineraries/{$trip->id}")->assertNotFound();
        $this->actingAs($stranger)->putJson("/api/itineraries/{$trip->id}", ['title' => 'Nope'])->assertNotFound();
        $this->actingAs($stranger)->deleteJson("/api/itineraries/{$trip->id}")->assertNotFound();
        $this->actingAs($stranger)->getJson("/api/itineraries/{$trip->id}/changes?since_version=0")->assertNotFound();
        $this->actingAs($stranger)->getJson("/api/itineraries/{$trip->id}/activities")->assertNotFound();
        $this->actingAs($stranger)->getJson("/api/itineraries/{$trip->id}/export?format=ics")->assertNotFound();
        $this->actingAs($stranger)->deleteJson("/api/itineraries/{$trip->id}/items/{$item->id}")->assertNotFound();
    }

    public function test_admins_do_not_get_private_trip_access_without_membership(): void
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $trip = Itinerary::factory()->for($owner)->create();

        $this->actingAs($admin)->getJson("/api/itineraries/{$trip->id}")->assertNotFound();
        $this->actingAs($admin)->getJson('/api/itineraries')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_share_budget_false_hides_budget_from_viewers_in_api_and_ics_export(): void
    {
        [$owner, $viewer] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create([
            'trip_type' => 'group',
            'share_budget' => false,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-02',
            'budget' => 10000,
        ]);
        ItineraryItem::factory()->for($trip)->create(['estimated_budget' => 2500, 'day_number' => 1]);
        $this->attachMember($trip, $viewer, 'viewer');

        $this->actingAs($viewer)
            ->getJson("/api/itineraries/{$trip->id}")
            ->assertOk()
            ->assertJsonPath('data.budget', null)
            ->assertJsonPath('data.total_budget', null)
            ->assertJsonPath('data.items.0.estimated_budget', null);

        $response = $this->actingAs($viewer)->get("/api/itineraries/{$trip->id}/export?format=ics");
        $response->assertOk();
        $this->assertStringNotContainsString('Budget:', $response->getContent());

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}", ['share_budget' => true])
            ->assertOk();

        $this->actingAs($viewer)
            ->getJson("/api/itineraries/{$trip->id}")
            ->assertOk()
            ->assertJsonPath('data.budget', '10000.00')
            ->assertJsonPath('data.items.0.estimated_budget', '2500.00');
    }

    public function test_stale_base_version_returns_409_with_fresh_state(): void
    {
        $owner = User::factory()->create();
        $trip = Itinerary::factory()->for($owner)->create(['title' => 'Original']);
        $item = ItineraryItem::factory()->for($trip)->create(['notes' => 'Original note']);

        $this->actingAs($owner)->putJson("/api/itineraries/{$trip->id}", ['title' => 'First edit'])->assertOk();
        $staleVersion = $trip->fresh()->version - 1;

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}", [
                'title' => 'Stale edit',
                'base_version' => $staleVersion,
            ])
            ->assertConflict()
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('data.title', 'First edit')
            ->assertJsonPath('data.version', $trip->fresh()->version);

        $this->actingAs($owner)->putJson("/api/itineraries/{$trip->id}/items/{$item->id}", ['notes' => 'New note'])->assertOk();
        $staleItemVersion = $trip->fresh()->version - 1;

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}/items/{$item->id}", [
                'notes' => 'Stale note',
                'base_version' => $staleItemVersion,
            ])
            ->assertConflict()
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('stop.notes', 'New note');
    }

    public function test_changes_endpoint_uses_versions_not_activity_ids(): void
    {
        $owner = User::factory()->create();
        $trip = Itinerary::factory()->for($owner)->create(['version' => 5]);

        $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/changes?since_version=5")
            ->assertOk()
            ->assertJsonPath('data.changed', false)
            ->assertJsonPath('data.version', 5)
            ->assertJsonCount(0, 'data.activities');

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}", ['title' => 'Changed'])
            ->assertOk();

        $this->actingAs($owner)
            ->getJson("/api/itineraries/{$trip->id}/changes?since_version=5")
            ->assertOk()
            ->assertJsonPath('data.changed', true)
            ->assertJsonPath('data.version', 6)
            ->assertJsonPath('data.activities.0.action', 'itinerary.updated');
    }

    public function test_link_invites_store_only_a_hash_and_enforce_expiry_revocation_and_use_limits(): void
    {
        [$owner, $first, $second] = User::factory()->count(3)->create();
        $trip = Itinerary::factory()->for($owner)->create();

        $response = $this->actingAs($owner)->postJson("/api/itineraries/{$trip->id}/invite-links", [
            'role' => 'editor',
            'max_uses' => 1,
        ])->assertCreated();

        $raw = $response->json('token');
        $this->assertIsString($raw);
        $this->assertDatabaseMissing('itinerary_invites', ['token' => $raw]);
        $this->assertDatabaseHas('itinerary_invites', ['itinerary_id' => $trip->id, 'token' => hash('sha256', $raw)]);
        $this->assertStringContainsString('/invite/'.$raw, $response->json('invite_url'));

        $this->actingAs($first)
            ->getJson("/api/invite-links/{$raw}")
            ->assertOk()
            ->assertJsonPath('data.itinerary_name', $trip->title)
            ->assertJsonMissingPath('data.items');

        $this->actingAs($first)->postJson("/api/invite-links/{$raw}/accept")->assertOk();
        $this->assertDatabaseHas('itinerary_user', [
            'itinerary_id' => $trip->id,
            'user_id' => $first->id,
            'role' => 'editor',
            'status' => 'accepted',
        ]);

        $this->actingAs($second)->postJson("/api/invite-links/{$raw}/accept")->assertStatus(410);

        $expiredRaw = 'expired-token-'.str_repeat('x', 40);
        ItineraryInvite::factory()->for($trip)->create([
            'token' => hash('sha256', $expiredRaw),
            'expires_at' => now()->subMinute(),
            'type' => 'link',
        ]);
        $this->actingAs($second)->getJson("/api/invite-links/{$expiredRaw}")->assertStatus(410);

        $revokedRaw = 'revoked-token-'.str_repeat('x', 40);
        ItineraryInvite::factory()->for($trip)->create([
            'token' => hash('sha256', $revokedRaw),
            'revoked_at' => now(),
            'type' => 'link',
        ]);
        $this->actingAs($second)->postJson("/api/invite-links/{$revokedRaw}/accept")->assertStatus(410);
    }

    public function test_blocked_user_cannot_redeem_a_link(): void
    {
        [$owner, $blocked] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create();

        $raw = $this->actingAs($owner)->postJson("/api/itineraries/{$trip->id}/invite-links", [
            'role' => 'viewer',
        ])->assertCreated()->json('token');

        $this->actingAs($owner)->postJson("/api/blocks/{$blocked->id}")->assertOk();

        $this->actingAs($blocked)->postJson("/api/invite-links/{$raw}/accept")->assertForbidden();
    }

    public function test_owner_can_transfer_ownership_to_an_accepted_member(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $trip = Itinerary::factory()->for($owner)->create(['trip_type' => 'group']);
        $this->attachMember($trip, $member, 'viewer');

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/transfer-ownership", ['user_id' => $member->id])
            ->assertOk();

        $this->assertSame($member->id, $trip->fresh()->user_id);
        $this->assertDatabaseHas('itinerary_user', [
            'itinerary_id' => $trip->id,
            'user_id' => $owner->id,
            'role' => 'editor',
            'status' => 'accepted',
        ]);

        $this->actingAs($owner)
            ->putJson("/api/itineraries/{$trip->id}", ['title' => 'No longer owner'])
            ->assertOk();

        $this->actingAs($owner)
            ->postJson("/api/itineraries/{$trip->id}/members", [
                'user_ids' => [$member->id],
                'role' => 'viewer',
            ])
            ->assertForbidden();
    }

    private function makeFriends(User $a, User $b): Friendship
    {
        return Friendship::create([
            'requester_id' => $a->id,
            'addressee_id' => $b->id,
            'status' => 'accepted',
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
        $trip->forceFill(['trip_type' => Itinerary::TRIP_GROUP])->save();
    }
}
