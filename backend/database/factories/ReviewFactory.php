<?php

namespace Database\Factories;

use App\Models\Destination;
use App\Models\Review;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Review>
 */
class ReviewFactory extends Factory
{
    protected $model = Review::class;

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
            'visit_id' => null,
            'rating' => fake()->numberBetween(1, 5),
            'title' => fake()->optional()->sentence(4),
            'body' => fake()->paragraph(),
            'visited_on' => fake()->optional()->dateTimeBetween('-1 year', 'now')?->format('Y-m-d'),
            'is_hidden' => false,
        ];
    }

    /**
     * A hidden (moderated) review.
     */
    public function hidden(): static
    {
        return $this->state(fn () => [
            'is_hidden' => true,
            'hidden_reason' => 'Flagged by word filter.',
        ]);
    }
}
