<?php

namespace Tests\Feature;

use App\Models\Destination;
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
        $south = Destination::factory()->create(['region' => 'South Cebu', 'name' => 'Kawasan Falls']);
        Destination::factory()->create(['region' => 'North Cebu', 'name' => 'Bantayan']);

        $this->getJson('/api/destinations?region=South Cebu')
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
}
