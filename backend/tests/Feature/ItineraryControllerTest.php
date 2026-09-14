<?php

namespace Tests\Feature;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_lists_own_itineraries_only(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        Itinerary::factory()->count(2)->for($user)->create();
        Itinerary::factory()->count(1)->for($other)->create();

        $this->actingAs($user)
            ->getJson('/api/itineraries')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_lists_requires_authentication(): void
    {
        $this->getJson('/api/itineraries')->assertUnauthorized();
    }

    public function test_creates_itinerary_with_valid_payload(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/itineraries', [
            'title' => 'Cebu Weekend Trip',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-03',
            'budget' => 15000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Cebu Weekend Trip')
            ->assertJsonPath('data.total_budget', 0)
            ->assertJsonPath('data.budget', '15000.00');

        $this->assertDatabaseHas('itineraries', [
            'title' => 'Cebu Weekend Trip',
            'user_id' => $user->id,
            'budget' => 15000,
        ]);
    }

    public function test_creates_itinerary_requires_title_and_dates(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/itineraries', [
                'start_date' => '2026-11-01',
                'end_date' => '2026-10-01',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'end_date']);
    }

    public function test_end_date_must_be_after_start_date(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/itineraries', [
                'title' => 'Invalid Dates',
                'start_date' => '2026-11-03',
                'end_date' => '2026-11-01',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('end_date');
    }

    public function test_shows_own_itinerary_with_items(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->recycle($user)->create();
        $item = ItineraryItem::factory()->recycle($itinerary)->create();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $itinerary->id)
            ->assertJsonCount(1, 'data.items');
    }

    public function test_returns_404_when_viewing_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();

        $this->actingAs($user)
            ->getJson("/api/itineraries/{$itinerary->id}")
            ->assertNotFound();
    }

    public function test_creates_itinerary_without_budget_when_omitted(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/itineraries', [
            'title' => 'No Budget Trip',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.budget', null);

        $this->assertNull(Itinerary::query()->where('title', 'No Budget Trip')->first()->budget);
    }

    public function test_updates_own_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create(['title' => 'Old Title', 'budget' => null]);

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}", ['title' => 'New Title', 'budget' => 25000])
            ->assertOk()
            ->assertJsonPath('data.title', 'New Title')
            ->assertJsonPath('data.budget', '25000.00');

        $this->assertDatabaseHas('itineraries', ['id' => $itinerary->id, 'title' => 'New Title', 'budget' => 25000]);
    }

    public function test_returns_404_when_updating_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();

        $this->actingAs($user)
            ->putJson("/api/itineraries/{$itinerary->id}", ['title' => 'Hacked'])
            ->assertNotFound();
    }

    public function test_deletes_own_itinerary(): void
    {
        $user = User::factory()->create();
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->deleteJson("/api/itineraries/{$itinerary->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('itineraries', ['id' => $itinerary->id]);
    }

    public function test_returns_404_when_deleting_another_users_itinerary(): void
    {
        $user = User::factory()->create();
        $owner = User::factory()->create();
        $itinerary = Itinerary::factory()->for($owner)->create();

        $this->actingAs($user)
            ->deleteJson("/api/itineraries/{$itinerary->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('itineraries', ['id' => $itinerary->id]);
    }

    public function test_requires_authentication_for_update_and_delete(): void
    {
        $itinerary = Itinerary::factory()->create();

        $this->putJson("/api/itineraries/{$itinerary->id}", ['title' => 'X'])->assertUnauthorized();
        $this->deleteJson("/api/itineraries/{$itinerary->id}")->assertUnauthorized();
    }
}
