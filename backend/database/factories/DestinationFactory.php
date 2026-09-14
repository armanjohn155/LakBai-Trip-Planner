<?php

namespace Database\Factories;

use App\Models\Destination;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Destination>
 */
class DestinationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'description' => fake()->paragraph(),
            'category' => fake()->randomElement([
                'Beach',
                'Waterfall',
                'Mountains & Hiking',
                'Historical & Cultural',
                'Religious Sites',
                'Food & Restaurants',
                'Diving & Water Activities',
                'Nature & Eco-Tourism',
                'Islands',
            ]),
            'region' => fake()->randomElement(Destination::REGIONS),
            'municipality' => fake()->randomElement([
                'Cebu City',
                'Badian',
                'Bantayan',
                'Moalboal',
                'Oslob',
                'Dalaguete',
            ]),
            'latitude' => fake()->latitude(9.4, 11.4),
            'longitude' => fake()->longitude(123.2, 124.3),
            'estimated_cost' => fake()->randomFloat(2, 0, 2000),
            'rating' => fake()->randomFloat(1, 4.0, 5.0),
            'review_count' => fake()->numberBetween(0, 15000),
            'image_url' => fake()->imageUrl(640, 480, 'nature', true),
            'best_time_to_visit' => fake()->sentence(4),
            'tips' => fake()->paragraph(),
        ];
    }
}
