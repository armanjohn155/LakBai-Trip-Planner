<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tracking_sessions')) {
            return;
        }

        Schema::create('tracking_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('itinerary_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 16)->default('active');
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('distance_m')->default(0);
            $table->decimal('last_lat', 10, 7)->nullable();
            $table->decimal('last_lng', 10, 7)->nullable();
            $table->unsignedInteger('last_accuracy_m')->nullable();
            $table->timestamp('last_point_at')->nullable();
            $table->timestamps();

            $table->index(['itinerary_id', 'user_id']);
            $table->index(['itinerary_id', 'user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_sessions');
    }
};
