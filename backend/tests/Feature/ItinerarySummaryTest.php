<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItinerarySummaryTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_returns_total_budget_and_breakdown(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $beach = Destination::factory()->create(['category' => 'Beach', 'estimated_cost' => 1000]);
        $food = Destination::factory()->create(['category' => 'Food', 'estimated_cost' => 500]);

        ItineraryItem::factory()->recycle($itinerary)->create([
            'destination_id' => $beach->id,
            'estimated_budget' => 800,
            'day_number' => 1,
            'order' => 0,
        ]);
        ItineraryItem::factory()->recycle($itinerary)->create([
            'destination_id' => $food->id,
            'estimated_budget' => 200,
            'day_number' => 2,
            'order' => 0,
        ]);

        $response = $this->actingAs($user)->getJson("/api/itineraries/{$itinerary->id}/summary");

        $response->assertOk()
            ->assertJsonPath('data.total_budget', 1000)
            ->assertJsonPath('data.item_count', 2)
            ->assertJsonPath('data.day_count', 2)
            ->assertJsonCount(2, 'data.breakdown_by_category')
            ->assertJsonFragment([
                'category' => 'Beach',
                'item_count' => 1,
                'estimated_budget' => 800,
            ])
            ->assertJsonFragment([
                'category' => 'Food',
                'item_count' => 1,
                'estimated_budget' => 200,
            ]);
    }

    public function test_returns_zero_budget_for_empty_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.total_budget', 0)
            ->assertJsonPath('data.item_count', 0)
            ->assertJsonCount(0, 'data.breakdown_by_category');
    }

    public function test_returns_404_for_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/summary")
            ->assertNotFound();
    }
}
