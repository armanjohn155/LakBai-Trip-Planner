<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryCustomStopTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_adds_custom_stop_with_title_and_coordinates(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $response = $this->actingAs($user)->postJson("/api/itineraries/{$itinerary->id}/items", [
            'custom_title' => 'Coffee stop',
            'custom_latitude' => 10.3157,
            'custom_longitude' => 123.8854,
            'custom_address' => 'Somewhere downtown',
            'category' => 'Meal',
            'start_time' => '09:30',
            'duration_minutes' => 45,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.items.0.is_custom', true)
            ->assertJsonPath('data.items.0.title', 'Coffee stop')
            ->assertJsonPath('data.items.0.category', 'Meal');

        $this->assertDatabaseHas('itinerary_items', [
            'itinerary_id' => $itinerary->id,
            'destination_id' => null,
            'custom_title' => 'Coffee stop',
            'start_time' => '09:30',
            'duration_minutes' => 45,
            'status' => 'planned',
        ]);
    }

    public function test_custom_stop_requires_title_and_coordinates(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['destination_id', 'custom_title']);
    }

    public function test_add_item_rejects_invalid_time_and_duration(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", [
                'destination_id' => $destination->id,
                'start_time' => '25:99',
                'duration_minutes' => 2,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_time', 'duration_minutes']);
    }

    public function test_add_item_rejects_day_number_above_thirty(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", [
                'destination_id' => $destination->id,
                'day_number' => 31,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('day_number');
    }

    public function test_add_item_rejects_unknown_category(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/itineraries/{$itinerary->id}/items", [
                'destination_id' => $destination->id,
                'category' => 'Nonsense',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');
    }

    public function test_switching_a_custom_stop_to_a_destination_clears_custom_details(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $custom = ItineraryItem::factory()->recycle($itinerary)->custom()->create();
        $destination = Destination::factory()->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$custom->id}", [
                'destination_id' => $destination->id,
            ])
            ->assertOk();

        $this->assertDatabaseHas('itinerary_items', [
            'id' => $custom->id,
            'destination_id' => $destination->id,
            'custom_title' => null,
            'custom_latitude' => null,
            'custom_longitude' => null,
        ]);
    }

    public function test_update_rejects_removing_destination_from_custom_less_stop(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", [
                'destination_id' => null,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('custom_title');
    }

    public function test_updates_item_status(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}/items/{$item->id}", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('data.items.0.status', 'done');

        $this->assertDatabaseHas('itinerary_items', ['id' => $item->id, 'status' => 'done']);
    }
}
