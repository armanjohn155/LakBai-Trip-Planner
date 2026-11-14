<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A single short-lived "meet here" pin per trip. Expired pins are ignored
     * on read and pruned by the scheduled tracking command.
     */
    public function up(): void
    {
        Schema::create('itinerary_meetups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('itinerary_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('note', 140)->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['itinerary_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itinerary_meetups');
    }
};
