<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-managed destination categories.
 *
 * Destinations keep storing the category name as a plain string, so this table
 * is additive: existing rows stay valid and no foreign key is required.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('destination_categories')) {
            return;
        }

        Schema::create('destination_categories', function (Blueprint $table) {
            // Slightly wider than the 50-character input limit so legacy values
            // can always be seeded without truncation.
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 120)->unique();
            $table->string('icon', 40)->nullable();
            $table->string('color', 7)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        // Case-insensitive uniqueness works on PostgreSQL and SQLite.
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS destination_categories_name_lower_unique ON destination_categories (LOWER(name))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS destination_categories_name_lower_unique');
        Schema::dropIfExists('destination_categories');
    }
};
