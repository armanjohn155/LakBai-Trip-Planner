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
        Schema::create('itinerary_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('itinerary_id')->constrained()->cascadeOnDelete();
            $table->string('email')->nullable();
            $table->string('token_hash', 64)->unique();
            $table->enum('role', ['editor', 'viewer']);
            $table->enum('type', ['email', 'link']);
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('uses_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index('itinerary_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('itinerary_invites');
    }
};
