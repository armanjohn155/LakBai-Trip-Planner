<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Destinations are soft deleted, so a hard delete of the destination
            // should not silently erase a user's visiting history.
            $table->foreignId('destination_id')->constrained();
            $table->foreignId('itinerary_stop_id')->nullable()->constrained('itinerary_items')->nullOnDelete();
            $table->boolean('verified')->default(false);
            $table->string('method')->default('manual');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedInteger('distance_m')->nullable();
            $table->unsignedInteger('accuracy_m')->nullable();
            $table->timestamp('visited_at');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'visited_at']);
            $table->index(['destination_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
