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
            'description' => fake()->optional(0.5, null)->sentence(),
            'start_date' => fake()->date(),
            'end_date' => fake()->date(),
            'budget' => fake()->optional(0.6, null)->numberBetween(2000, 50000),
            'total_budget' => fake()->optional(0.5, null)->numberBetween(2000, 60000),
            'is_template' => false,
            'template_key' => null,
        ];
    }

    /**
     * Mark the itinerary as an admin-curated template.
     */
    public function template(?string $key = null): static
    {
        return $this->state(fn (array $attributes) => [
            'is_template' => true,
            'template_key' => $key ?? fake()->unique()->slug(3),
        ]);
    }
}
