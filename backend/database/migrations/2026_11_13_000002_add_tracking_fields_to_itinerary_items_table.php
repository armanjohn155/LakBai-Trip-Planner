<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stop-level lifecycle timestamps and a direct link to the verified visit
     * that completed the stop. `status` already exists as a string column.
     */
    public function up(): void
    {
        Schema::table('itinerary_items', function (Blueprint $table) {
            if (! Schema::hasColumn('itinerary_items', 'arrived_at')) {
                $table->timestamp('arrived_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('itinerary_items', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('arrived_at');
            }
            if (! Schema::hasColumn('itinerary_items', 'visit_id')) {
                $table->foreignId('visit_id')->nullable()->after('completed_at')
                    ->constrained('visits')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('itinerary_items', function (Blueprint $table) {
            if (Schema::hasColumn('itinerary_items', 'visit_id')) {
                $table->dropConstrainedForeignId('visit_id');
            }
            if (Schema::hasColumn('itinerary_items', 'completed_at')) {
                $table->dropColumn('completed_at');
            }
            if (Schema::hasColumn('itinerary_items', 'arrived_at')) {
                $table->dropColumn('arrived_at');
            }
        });
    }
};
