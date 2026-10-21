<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryBudgetTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_summary_reports_over_budget_when_estimates_exceed_limit(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create([
            'budget' => null,
            'total_budget' => 1000,
        ]);

        ItineraryItem::factory()->recycle($itinerary)->create([
            'estimated_budget' => 800,
            'day_number' => 1,
            'order' => 1,
        ]);
        ItineraryItem::factory()->recycle($itinerary)->create([
            'estimated_budget' => 500,
            'day_number' => 2,
            'order' => 1,
        ]);

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.total_budget', 1300)
            ->assertJsonPath('data.budget_limit', 1000)
            ->assertJsonPath('data.remaining_budget', -300)
            ->assertJsonPath('data.over_budget', true);
    }

    public function test_summary_falls_back_to_legacy_budget_when_total_budget_missing(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create([
            'budget' => 5000,
            'total_budget' => null,
        ]);

        ItineraryItem::factory()->recycle($itinerary)->create([
            'estimated_budget' => 2000,
            'day_number' => 1,
            'order' => 1,
        ]);

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}/summary")
            ->assertOk()
            ->assertJsonPath('data.budget_limit', 5000)
            ->assertJsonPath('data.remaining_budget', 3000)
            ->assertJsonPath('data.over_budget', false);
    }

    public function test_item_resource_flags_soft_deleted_destination_as_unavailable(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destination = Destination::factory()->create(['name' => 'Gone Place']);
        $item = ItineraryItem::factory()->recycle($itinerary)->create([
            'destination_id' => $destination->id,
        ]);

        $destination->delete();

        $response = $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.unavailable', true);

        $this->assertSame($item->id, $response->json('data.items.0.id'));
    }

    public function test_item_resource_flags_verified_when_user_has_verified_visit(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();
        $destination = Destination::factory()->create();
        ItineraryItem::factory()->recycle($itinerary)->create([
            'destination_id' => $destination->id,
        ]);

        Visit::factory()->verified()->for($user)->create([
            'destination_id' => $destination->id,
        ]);

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.verified', true);
    }
}
