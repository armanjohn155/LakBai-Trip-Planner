<?php

use Database\Seeders\AdminSeeder;
use Database\Seeders\DestinationOptionSeeder;
use Database\Seeders\DestinationSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        (new DestinationSeeder)->run();
        (new DestinationOptionSeeder)->run();
        try {
            (new AdminSeeder)->run();
        } catch (Throwable $e) {
            // AdminSeeder requires ADMIN_EMAIL / ADMIN_PASSWORD; ignore if unset
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {}
};
