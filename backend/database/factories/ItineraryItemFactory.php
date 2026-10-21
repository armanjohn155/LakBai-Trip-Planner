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
            'start_time' => fake()->optional(0.5, null)->time('H:i'),
            'duration_minutes' => fake()->optional(0.5, null)->numberBetween(30, 240),
            'category' => null,
            'estimated_budget' => fake()->randomFloat(2, 0, 2000),
            'notes' => fake()->sentence(),
            'visited' => false,
            'status' => 'planned',
        ];
    }

    /**
     * A free-form stop that has no destination.
     */
    public function custom(): static
    {
        return $this->state(fn (array $attributes) => [
            'destination_id' => null,
            'custom_title' => fake()->words(3, true),
            'custom_latitude' => fake()->latitude(9.4, 11.4),
            'custom_longitude' => fake()->longitude(123.2, 124.3),
            'custom_address' => fake()->address(),
        ]);
    }
}
