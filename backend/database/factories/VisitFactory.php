<?php

namespace Database\Factories;

use App\Models\Destination;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Visit>
 */
class VisitFactory extends Factory
{
    protected $model = Visit::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'destination_id' => Destination::factory(),
            'itinerary_stop_id' => null,
            'verified' => false,
            'method' => 'manual',
            'latitude' => null,
            'longitude' => null,
            'distance_m' => null,
            'accuracy_m' => null,
            'visited_at' => fake()->dateTimeBetween('-6 months', 'now'),
            'notes' => null,
        ];
    }

    /**
     * A GPS-verified visit.
     */
    public function verified(): static
    {
        return $this->state(fn () => [
            'verified' => true,
            'method' => 'gps',
            'accuracy_m' => 20,
        ]);
    }
}
