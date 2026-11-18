<?php

use App\Services\DestinationOptionService;
use Illuminate\Database\Migrations\Migration;

/**
 * Populate the new option tables so every destination has a matching option.
 * Idempotent: re-running the migration (or the seeder) only fills gaps.
 */
return new class extends Migration
{
    public function up(): void
    {
        app(DestinationOptionService::class)->seedDefaults();
    }

    public function down(): void
    {
        // Data is intentionally kept; the option tables are dropped by their own
        // migrations in reverse order.
    }
};
