<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ItineraryTemplateTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_lists_only_template_itineraries(): void
    {
        $user = User::factory()->create();
        Itinerary::factory()->for($user)->template('sun-route')->create(['title' => 'Sun Route']);
        Itinerary::factory()->for($user)->create(['title' => 'Private Plan']);

        $this->actingAs($user)
            ->getJson('/api/itinerary-templates')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.template_key', 'sun-route');
    }

    public function test_lists_requires_authentication(): void
    {
        $this->getJson('/api/itinerary-templates')->assertUnauthorized();
    }

    public function test_uses_template_to_create_own_itinerary_copy(): void
    {
        $owner = User::factory()->create();
        $user = User::factory()->create();

        $template = Itinerary::factory()->for($owner)->template('city-loop')->create([
            'title' => 'City Loop',
            'description' => 'A loop',
            'budget' => 3000,
        ]);
        $destination = Destination::factory()->create();
        ItineraryItem::factory()->recycle($template)->create([
            'destination_id' => $destination->id,
            'day_number' => 1,
            'order' => 1,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/itinerary-templates/{$template->id}/use");

        $response->assertCreated()
            ->assertJsonPath('data.title', 'City Loop')
            ->assertJsonPath('data.is_template', false)
            ->assertJsonCount(1, 'data.items');

        $this->assertDatabaseHas('itineraries', [
            'id' => $response->json('data.id'),
            'user_id' => $user->id,
            'is_template' => 0,
        ]);
    }

    public function test_using_a_template_converts_soft_deleted_destinations_to_custom_stops(): void
    {
        $owner = User::factory()->create();
        $user = User::factory()->create();

        $template = Itinerary::factory()->for($owner)->template('gone')->create(['title' => 'Gone']);
        $destination = Destination::factory()->create(['name' => 'Closed Beach']);
        ItineraryItem::factory()->recycle($template)->create([
            'destination_id' => $destination->id,
            'day_number' => 1,
            'order' => 1,
        ]);

        $destination->delete();

        $response = $this->actingAs($user)
            ->postJson("/api/itinerary-templates/{$template->id}/use")
            ->assertCreated();

        $this->assertDatabaseHas('itinerary_items', [
            'itinerary_id' => $response->json('data.id'),
            'destination_id' => null,
            'custom_title' => 'Closed Beach',
        ]);
    }

    public function test_use_returns_404_for_non_template_itinerary(): void
    {
        $user = User::factory()->create();
        $private = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/itinerary-templates/{$private->id}/use")
            ->assertNotFound();
    }

    public function test_admin_marks_and_unmarks_a_template(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $itinerary = Itinerary::factory()->for(User::factory())->create(['title' => 'Featured Plan']);

        $this->actingAs($admin)
            ->postJson("/api/admin/itineraries/{$itinerary->id}/template", [])
            ->assertOk()
            ->assertJsonPath('data.is_template', true)
            ->assertJsonPath('data.template_key', 'featured-plan');

        $this->assertDatabaseHas('itineraries', ['id' => $itinerary->id, 'is_template' => 1]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/itineraries/{$itinerary->id}/template")
            ->assertOk()
            ->assertJsonPath('data.is_template', false);

        $this->assertDatabaseHas('itineraries', ['id' => $itinerary->id, 'is_template' => 0, 'template_key' => null]);
    }

    public function test_non_admin_cannot_mark_template(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        $itinerary = Itinerary::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson("/api/admin/itineraries/{$itinerary->id}/template", [])
            ->assertForbidden();
    }
}
