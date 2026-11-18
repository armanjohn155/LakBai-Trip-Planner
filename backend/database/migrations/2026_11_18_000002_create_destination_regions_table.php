<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-managed destination regions. Like categories, the destination row keeps
 * the region name as a string.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('destination_regions')) {
            return;
        }

        Schema::create('destination_regions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 120)->unique();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS destination_regions_name_lower_unique ON destination_regions (LOWER(name))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS destination_regions_name_lower_unique');
        Schema::dropIfExists('destination_regions');
    }
};
