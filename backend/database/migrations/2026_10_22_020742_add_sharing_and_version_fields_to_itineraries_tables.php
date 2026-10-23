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
        Schema::table('itineraries', function (Blueprint $table) {
            // Bumped on every successful write; drives optimistic conflict checks.
            $table->unsignedInteger('version')->default(1)->after('template_key');
            $table->foreignId('updated_by')->nullable()->after('version')->constrained('users')->nullOnDelete();
            // When false, viewers do not receive budget fields.
            $table->boolean('share_budget')->default(true)->after('updated_by');
        });

        Schema::table('itinerary_items', function (Blueprint $table) {
            $table->foreignId('updated_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('itineraries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('updated_by');
            $table->dropColumn(['version', 'share_budget']);
        });

        Schema::table('itinerary_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('updated_by');
        });
    }
};
