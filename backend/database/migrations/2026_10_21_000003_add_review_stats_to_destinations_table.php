<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('destinations', function (Blueprint $table) {
            // Baseline imported from outside sources, preserved so seeded ratings stay meaningful.
            $table->decimal('base_rating', 2, 1)->nullable()->after('review_count');
            $table->unsignedBigInteger('base_review_count')->default(0)->after('base_rating');
            // Derived from Lakbai reviews only.
            $table->decimal('lakbai_rating_avg', 3, 2)->nullable()->after('base_review_count');
            $table->unsignedBigInteger('lakbai_review_count')->default(0)->after('lakbai_rating_avg');
        });

        // Preserve the currently seeded values as the baseline before anything recalculates them.
        DB::table('destinations')->update([
            'base_rating' => DB::raw('rating'),
            'base_review_count' => DB::raw('review_count'),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('destinations', function (Blueprint $table) {
            $table->dropColumn(['base_rating', 'base_review_count', 'lakbai_rating_avg', 'lakbai_review_count']);
        });
    }
};
