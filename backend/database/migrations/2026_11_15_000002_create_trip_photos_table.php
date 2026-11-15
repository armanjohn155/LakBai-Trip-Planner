<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photos attached to a trip recap. Files live on the local "public" disk;
 * only metadata is stored in PostgreSQL.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('trip_photos')) {
            return;
        }

        Schema::create('trip_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('itinerary_id')->constrained()->cascadeOnDelete();
            $table->foreignId('itinerary_item_id')->nullable()
                ->constrained('itinerary_items')->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('caption', 200)->nullable();
            $table->timestamp('taken_at')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['itinerary_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trip_photos');
    }
};
