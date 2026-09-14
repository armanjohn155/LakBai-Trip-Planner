<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class FavoritesControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_guests_cannot_list_favorites(): void
    {
        $this->getJson('/api/favorites')->assertUnauthorized();
    }

    public function test_user_can_favorite_a_destination(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/favorites/{$destination->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $destination->id)
            ->assertJsonPath('data.is_favorited', true);

        $this->assertDatabaseHas('favorites', [
            'user_id' => $user->id,
            'destination_id' => $destination->id,
        ]);
    }

    public function test_favoriting_twice_is_idempotent(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)->postJson("/api/favorites/{$destination->id}")->assertOk();
        $this->actingAs($user)->postJson("/api/favorites/{$destination->id}")->assertOk();

        $this->assertDatabaseCount('favorites', 1);
    }

    public function test_favorites_index_lists_favorited_destinations(): void
    {
        $user = User::factory()->create();
        $favorite = Destination::factory()->create(['name' => 'Kawasan Falls']);
        Destination::factory()->create(['name' => 'Not Favorited']);

        $user->favoriteDestinations()->attach($favorite);

        $this->actingAs($user)
            ->getJson('/api/favorites')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $favorite->id)
            ->assertJsonPath('data.0.is_favorited', true);
    }

    public function test_user_can_remove_a_favorite(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create();
        $user->favoriteDestinations()->attach($destination);

        $this->actingAs($user)
            ->deleteJson("/api/favorites/{$destination->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('favorites', [
            'user_id' => $user->id,
            'destination_id' => $destination->id,
        ]);
    }

    public function test_favorites_are_isolated_between_users(): void
    {
        $first = User::factory()->create();
        $second = User::factory()->create();
        $destination = Destination::factory()->create();

        $first->favoriteDestinations()->attach($destination);

        $this->actingAs($second)
            ->getJson('/api/favorites')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_guests_see_is_favorited_as_false_when_omitted(): void
    {
        $destination = Destination::factory()->create();

        $this->getJson("/api/destinations/{$destination->id}")
            ->assertOk()
            ->assertJsonMissingPath('data.is_favorited');
    }

    public function test_authenticated_user_sees_favorite_state_in_destination_list(): void
    {
        $user = User::factory()->create();
        $favorite = Destination::factory()->create(['name' => 'Kawasan Falls']);
        Destination::factory()->create(['name' => 'Moalboal']);
        $user->favoriteDestinations()->attach($favorite);

        $this->actingAs($user)
            ->getJson('/api/destinations?per_page=100')
            ->assertOk()
            ->assertJsonPath('data.0.is_favorited', true)
            ->assertJsonPath('data.1.is_favorited', false);
    }
}
