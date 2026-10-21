<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryDuplicateTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_duplicates_itinerary_and_all_stops(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create([
            'title' => 'Original',
            'description' => 'A plan',
            'total_budget' => 9000,
        ]);
        $destination = Destination::factory()->create();
        ItineraryItem::factory()->recycle($itinerary)->create([
            'destination_id' => $destination->id,
            'day_number' => 1,
            'order' => 1,
            'estimated_budget' => 500,
            'notes' => 'First',
        ]);
        ItineraryItem::factory()->recycle($itinerary)->custom()->create([
            'day_number' => 2,
            'order' => 1,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/duplicate");

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Copy of Original')
            ->assertJsonPath('data.description', 'A plan')
            ->assertJsonCount(2, 'data.items');

        $copyId = $response->json('data.id');

        $this->assertNotSame($itinerary->id, $copyId);
        $this->assertDatabaseHas('itineraries', [
            'id' => $copyId,
            'user_id' => $user->id,
            'title' => 'Copy of Original',
        ]);
        $this->assertSame(2, ItineraryItem::query()->where('itinerary_id', $copyId)->count());
    }

    public function test_duplicate_resets_status_and_visited(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        ItineraryItem::factory()->recycle($itinerary)->create([
            'status' => 'done',
            'visited' => true,
        ]);

        $copyId = $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/duplicate")
            ->assertCreated()
            ->json('data.id');

        $this->assertDatabaseHas('itinerary_items', [
            'itinerary_id' => $copyId,
            'status' => 'planned',
            'visited' => 0,
        ]);
    }

    public function test_duplicate_returns_404_for_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/duplicate")
            ->assertNotFound();
    }
}
