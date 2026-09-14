<?php

namespace Database\Factories;

use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ItineraryItem>
 */
class ItineraryItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'itinerary_id' => Itinerary::factory(),
            'destination_id' => Destination::factory(),
            'day_number' => 1,
            'order' => 0,
            'estimated_budget' => fake()->randomFloat(2, 0, 2000),
            'notes' => fake()->sentence(),
            'visited' => false,
        ];
    }
}
