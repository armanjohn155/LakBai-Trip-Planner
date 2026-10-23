<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            DestinationSeeder::class,
            AdminSeeder::class,
            ItineraryTemplateSeeder::class,
        ]);

        if (app()->environment('local') && class_exists(\Database\Factories\UserFactory::class)) {
            try {
                User::factory()->create([
                    'name' => 'Test User',
                    'email' => 'test@example.com',
                ]);
            } catch (\Throwable $e) {
                // Ignore in environments where faker is not available.
            }
        }
    }
}

