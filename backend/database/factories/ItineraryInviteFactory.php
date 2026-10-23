<?php

namespace Database\Factories;

use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ItineraryInvite>
 */
class ItineraryInviteFactory extends Factory
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
            'email' => null,
            'token' => hash('sha256', Str::random(64)),
            'role' => 'viewer',
            'type' => 'link',
            'max_uses' => null,
            'uses_count' => 0,
            'expires_at' => now()->addDays(7),
            'revoked_at' => null,
            'created_by' => User::factory(),
        ];
    }

    public function email(string $email): static
    {
        return $this->state(fn (array $attributes) => [
            'email' => $email,
            'type' => 'email',
            'max_uses' => 1,
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => now()->subDay(),
        ]);
    }

    public function revoked(): static
    {
        return $this->state(fn (array $attributes) => [
            'revoked_at' => now(),
        ]);
    }

    public function editor(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'editor',
        ]);
    }
}
