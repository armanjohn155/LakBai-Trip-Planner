<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class DestinationControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_lists_destinations_paginated(): void
    {
        Destination::factory()->count(3)->create();
        Destination::factory()->count(1)->create(['name' => 'Aardvark Beach']);

        $response = $this->getJson('/api/destinations');
        $response->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'category', 'region', 'latitude', 'longitude']]]);
    }

    public function test_lists_destinations_filtered_by_region(): void
    {
        $south = Destination::factory()->create(['region' => 'South Cebu: Southwest and Highlands', 'name' => 'Kawasan Falls']);
        Destination::factory()->create(['region' => 'North Cebu Islands', 'name' => 'Bantayan']);

        $this->getJson('/api/destinations?region='.urlencode('South Cebu: Southwest and Highlands'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $south->id);
    }

    public function test_lists_destinations_filtered_by_category(): void
    {
        $waterfall = Destination::factory()->create(['category' => 'Waterfall', 'name' => 'Tumalog Falls']);
        Destination::factory()->create(['category' => 'Beach', 'name' => 'Moalboal']);

        $this->getJson('/api/destinations?category=Waterfall')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $waterfall->id);
    }

    public function test_searches_destinations_by_name(): void
    {
        $kawasan = Destination::factory()->create(['name' => 'Kawasan Falls']);
        Destination::factory()->create(['name' => 'Oslob Whale Watching']);

        $this->getJson('/api/destinations?search=Kawasan')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $kawasan->id);
    }

    public function test_filters_destinations_by_min_and_max_price(): void
    {
        $cheap = Destination::factory()->create(['estimated_cost' => 100, 'name' => 'Cheap Spot']);
        Destination::factory()->create(['estimated_cost' => 5000, 'name' => 'Expensive Resort']);

        $this->getJson('/api/destinations?min_price=0&max_price=500')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $cheap->id);
    }

    public function test_shows_destination_detail(): void
    {
        $destination = Destination::factory()->create();

        $this->getJson("/api/destinations/{$destination->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $destination->id)
            ->assertJsonPath('data.name', $destination->name);
    }

    public function test_returns_404_for_missing_destination(): void
    {
        $this->getJson('/api/destinations/999999')->assertNotFound();
    }

    public function test_newly_created_destination_is_immediately_visible_in_public_list_and_detail(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/destinations', [
                'name' => 'Bojo River',
                'description' => 'A calm river cruise through mangroves.',
                'category' => 'Nature & Eco-Tourism',
                'region' => 'South Cebu: Southwest and Highlands',
                'municipality' => 'Aloguinsan',
                'latitude' => 10.2101,
                'longitude' => 123.5495,
                'estimated_cost' => 450,
                'best_time_to_visit' => 'Morning',
                'tips' => 'Bring a hat.',
                'highlights' => ['Mangrove cruise'],
                'entrance_fee_text' => '450',
                'visit_duration' => '2 hours',
                'opening_hours' => '8:00 AM - 5:00 PM',
                'how_to_get_there' => [
                    ['mode' => 'Bus', 'route' => 'South Bus Terminal', 'duration' => '2 hours', 'price_text' => '120'],
                ],
                'travel_tips' => ['Do not litter.'],
                'gallery' => ['/storage/destinations/bojo-river.jpg'],
                'image_url' => '/storage/destinations/bojo-river.jpg',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Bojo River');

        $id = $response->json('data.id');

        $this->assertDatabaseHas('destinations', [
            'id' => $id,
            'name' => 'Bojo River',
            'source' => 'admin',
            'created_by' => $admin->id,
        ]);

        $this->getJson('/api/destinations')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $id,
                'name' => 'Bojo River',
                'category' => 'Nature & Eco-Tourism',
                'region' => 'South Cebu: Southwest and Highlands',
            ]);

        $this->getJson("/api/destinations/{$id}")
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.name', 'Bojo River');
    }
}
