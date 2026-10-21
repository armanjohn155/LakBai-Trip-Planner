<?php

namespace Tests\Feature;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryReorderTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_reorders_and_renumbers_stops_within_a_day(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $a = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 1]);
        $b = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 2]);
        $c = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 3]);

        // Move c between a and b.
        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/reorder", [
                'stops' => [
                    ['id' => $a->id, 'day_number' => 1, 'order' => 1],
                    ['id' => $c->id, 'day_number' => 1, 'order' => 2],
                    ['id' => $b->id, 'day_number' => 1, 'order' => 3],
                ],
            ])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', ['id' => $a->id, 'order' => 1]);
        $this->assertDatabaseHas('itinerary_items', ['id' => $c->id, 'order' => 2]);
        $this->assertDatabaseHas('itinerary_items', ['id' => $b->id, 'order' => 3]);
    }

    public function test_reorder_moves_stop_to_another_day_and_renumbers(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $a = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 1]);
        $b = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 2]);

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/reorder", [
                'stops' => [
                    ['id' => $a->id, 'day_number' => 1, 'order' => 1],
                    ['id' => $b->id, 'day_number' => 2, 'order' => 1],
                ],
            ])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', ['id' => $b->id, 'day_number' => 2, 'order' => 1]);
    }

    public function test_reorder_accepts_a_bare_array_payload(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $a = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 1]);

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/reorder", [
                ['id' => $a->id, 'day_number' => 1, 'order' => 5],
            ])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', ['id' => $a->id, 'order' => 1]);
    }

    public function test_reorder_rejects_foreign_stop_and_rolls_back(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $otherItinerary = Itinerary::factory()->for($user)->create();

        $mine = ItineraryItem::factory()->recycle($itinerary)->create(['day_number' => 1, 'order' => 1]);
        $foreign = ItineraryItem::factory()->recycle($otherItinerary)->create(['day_number' => 1, 'order' => 1]);

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/reorder", [
                'stops' => [
                    ['id' => $mine->id, 'day_number' => 1, 'order' => 1],
                    ['id' => $foreign->id, 'day_number' => 1, 'order' => 2],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('stops');

        $this->assertDatabaseHas('itinerary_items', ['id' => $foreign->id, 'itinerary_id' => $otherItinerary->id, 'order' => 1]);
    }

    public function test_reorder_returns_404_for_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/reorder", [
                'stops' => [['id' => $item->id, 'day_number' => 1, 'order' => 1]],
            ])
            ->assertNotFound();
    }
}
