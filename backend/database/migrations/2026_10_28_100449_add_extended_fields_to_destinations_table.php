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
        Schema::table('destinations', function (Blueprint $table) {
            // Highlights / amenities tags
            $table->json('highlights')->nullable();
            // Quick info as free text (keep estimated_cost for budgeting)
            $table->string('entrance_fee_text')->nullable();
            $table->string('visit_duration')->nullable();
            $table->string('opening_hours')->nullable();
            // Structured lists
            $table->json('how_to_get_there')->nullable();
            $table->json('travel_tips')->nullable();
            // Gallery (array of image paths). Keep image_url as cover.
            $table->json('gallery')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('destinations', function (Blueprint $table) {
            $table->dropColumn([
                'highlights',
                'entrance_fee_text',
                'visit_duration',
                'opening_hours',
                'how_to_get_there',
                'travel_tips',
                'gallery',
            ]);
        });
    }
};
