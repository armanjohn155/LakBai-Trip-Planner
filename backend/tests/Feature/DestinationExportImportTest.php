<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class DestinationExportImportTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_export_and_import_round_trip_admin_created_destinations(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $destination = Destination::factory()->create([
            'name' => 'Round Trip Spot',
            'source' => 'admin',
            'created_by' => $admin->id,
        ]);

        $this->artisan('destinations:export')->assertExitCode(0);

        $backupDir = storage_path('app/backups');
        $files = File::glob($backupDir.'/*.json');
        $this->assertNotEmpty($files);
        $latest = array_reduce($files, function ($carry, $item) {
            if ($carry === null) {
                return $item;
            }
            return filemtime($item) > filemtime($carry) ? $item : $carry;
        });

        // Delete and re-import
        $destination->forceDelete();

        $this->artisan('destinations:import', ['path' => $latest])->assertExitCode(0);

        $this->assertDatabaseHas('destinations', [
            'name' => 'Round Trip Spot',
            'source' => 'admin',
            'created_by' => $admin->id,
        ]);
    }
}
