<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\User;
use Database\Seeders\DestinationSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class DestinationSeederSafetyTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_seeder_does_not_delete_or_modify_admin_created_rows(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $destination = Destination::factory()->create([
            'name' => 'Admin Only Spot',
            'source' => 'admin',
            'created_by' => $admin->id,
            'description' => 'Original admin description',
        ]);

        $this->seed(DestinationSeeder::class);

        $destination->refresh();
        $this->assertSame('admin', $destination->source);
        $this->assertSame('Original admin description', $destination->description);
        $this->assertDatabaseHas('destinations', ['id' => $destination->id, 'name' => 'Admin Only Spot']);
    }

    public function test_seeder_does_not_overwrite_edits_to_seeded_rows(): void
    {
        $seeded = Destination::factory()->create([
            'name' => 'Kawasan Falls',
            'source' => 'seeded',
            'created_by' => null,
            'description' => 'Admin edited description',
        ]);

        $this->seed(DestinationSeeder::class);

        $seeded->refresh();
        $this->assertSame('Admin edited description', $seeded->description);
    }
}
