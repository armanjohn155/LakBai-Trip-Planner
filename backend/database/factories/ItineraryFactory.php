<?php

namespace Database\Factories;

use App\Models\Itinerary;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Itinerary>
 */
class ItineraryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->city().' Trip',
            'start_date' => fake()->date(),
            'end_date' => fake()->date(),
            'budget' => fake()->optional(0.6, null)->numberBetween(2000, 50000),
        ];
    }
}
