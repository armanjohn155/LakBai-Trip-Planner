<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryItemControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_adds_destination_to_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destination = Destination::factory()->create();

        $response = $this->actingAs($user)->postJson("/api/itineraries/{$itinerary->id}/items", [
            'destination_id' => $destination->id,
            'estimated_budget' => 1500,
            'notes' => 'Bring sunscreen',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', $itinerary->title)
            ->assertJsonCount(1, 'data.items');

        $this->assertDatabaseHas('itinerary_items', [
            'itinerary_id' => $itinerary->id,
            'destination_id' => $destination->id,
            'estimated_budget' => 1500,
            'day_number' => 1,
        ]);
    }

    public function test_adds_item_defaults_to_next_order_on_day(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destinationA = Destination::factory()->create();
        $destinationB = Destination::factory()->create();

        $this->actingAs($user)->postJson("/api/itineraries/{$itinerary->id}/items", [
            'destination_id' => $destinationA->id,
            'day_number' => 2,
        ])->assertCreated();

        $this->actingAs($user)->postJson("/api/itineraries/{$itinerary->id}/items", [
            'destination_id' => $destinationB->id,
            'day_number' => 2,
        ])->assertCreated();

        $this->assertDatabaseHas('itinerary_items', [
            'itinerary_id' => $itinerary->id,
            'destination_id' => $destinationB->id,
            'day_number' => 2,
            'order' => 1,
        ]);
    }

    public function test_add_item_requires_existing_destination(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", ['destination_id' => 999999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('destination_id');
    }

    public function test_returns_404_when_adding_item_to_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", ['destination_id' => $destination->id])
            ->assertNotFound();
    }

    public function test_updates_item_budget_order_notes(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create([
            'estimated_budget' => 500,
            'order' => 0,
        ]);

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", [
                'estimated_budget' => 800,
                'order' => 3,
                'notes' => 'Updated note',
            ])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', [
            'id' => $item->id,
            'estimated_budget' => 800,
            'order' => 3,
            'notes' => 'Updated note',
        ]);
    }

    public function test_updates_item_destination(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $newDestination = Destination::factory()->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", [
                'destination_id' => $newDestination->id,
            ])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', [
            'id' => $item->id,
            'destination_id' => $newDestination->id,
        ]);
    }

    public function test_returns_404_when_updating_another_users_item(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", ['notes' => 'Hacked'])
            ->assertNotFound();
    }

    public function test_returns_404_when_updating_item_not_in_route_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $otherItinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($otherItinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", ['notes' => 'Cross'])
            ->assertNotFound();
    }

    public function test_marks_and_unmarks_item_as_visited(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", ['visited' => true])
            ->assertOk()
            ->assertJsonPath('data.items.0.visited', true);

        $this->assertDatabaseHas('itinerary_items', ['id' => $item->id, 'visited' => 1]);

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", ['visited' => false])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', ['id' => $item->id, 'visited' => 0]);
    }

    public function test_deletes_item(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->deleteJson("/api/itineraries/{$itinerary->id}/items/{$item->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('itinerary_items', ['id' => $item->id]);
    }

    public function test_returns_404_when_deleting_another_users_item(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->deleteJson("/api/itineraries/{$itinerary->id}/items/{$item->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('itinerary_items', ['id' => $item->id]);
    }
}
