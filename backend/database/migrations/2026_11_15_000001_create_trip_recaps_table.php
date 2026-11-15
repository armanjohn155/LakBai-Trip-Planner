<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A completed trip's shareable recap. One row per itinerary; the row is
 * created lazily so a recap can be drafted before the trip is finished.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('trip_recaps')) {
            return;
        }

        Schema::create('trip_recaps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('itinerary_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('summary')->nullable();
            // Cross-table reference only; no FK so the recap and photos can be
            // created in either order without a circular constraint.
            $table->unsignedBigInteger('cover_photo_id')->nullable();
            $table->string('visibility', 16)->default('private');
            $table->string('share_token_hash', 64)->nullable()->unique();
            $table->timestamp('share_expires_at')->nullable();
            $table->boolean('hide_endpoints')->default(true);
            $table->boolean('show_stats')->default(true);
            $table->boolean('show_photos')->default(true);
            $table->string('theme_accent', 16)->default('surf');
            $table->json('route_geojson')->nullable();
            $table->json('stats')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trip_recaps');
    }
};
