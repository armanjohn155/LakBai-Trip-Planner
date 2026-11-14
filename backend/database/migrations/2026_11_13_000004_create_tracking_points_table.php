<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tracking_points')) {
            return;
        }

        Schema::create('tracking_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tracking_session_id')->constrained()->cascadeOnDelete();
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->unsignedInteger('accuracy_m');
            $table->decimal('speed_mps', 8, 2)->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['tracking_session_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_points');
    }
};
