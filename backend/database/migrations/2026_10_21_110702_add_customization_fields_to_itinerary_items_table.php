<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive customization fields for itinerary stops (table: itinerary_items).
     *
     * Existing columns are reused rather than renamed:
     *   - `order`            = intra-day position
     *   - `estimated_budget` = stop budget
     *   - `visited`          = retained for backwards compatibility; the new
     *                          `status` column supersedes it.
     *
     * `destination_id` is relaxed to nullable so a stop can be a free-form
     * "custom stop" carrying its own title and coordinates.
     */
    public function up(): void
    {
        Schema::table('itinerary_items', function (Blueprint $table) {
            // Allow custom (destination-less) stops.
            $table->foreignId('destination_id')->nullable()->change();

            $table->time('start_time')->nullable()->after('order');
            $table->unsignedInteger('duration_minutes')->nullable()->after('start_time');
            $table->string('category')->nullable()->after('duration_minutes');
            $table->string('status')->default('planned')->after('visited');

            $table->string('custom_title')->nullable()->after('destination_id');
            $table->decimal('custom_latitude', 10, 7)->nullable()->after('custom_title');
            $table->decimal('custom_longitude', 10, 7)->nullable()->after('custom_latitude');
            $table->string('custom_address')->nullable()->after('custom_longitude');
        });

        // Backfill: normalise the existing intra-day ordering to a stable 1..n
        // run per (itinerary, day) in the order rows currently appear.
        $this->backfillPositions();

        Schema::table('itinerary_items', function (Blueprint $table) {
            $table->index(['itinerary_id', 'day_number', 'order'], 'itinerary_items_day_position_index');
        });
    }

    public function down(): void
    {
        Schema::table('itinerary_items', function (Blueprint $table) {
            $table->dropIndex('itinerary_items_day_position_index');
            $table->dropColumn([
                'start_time',
                'duration_minutes',
                'category',
                'status',
                'custom_title',
                'custom_latitude',
                'custom_longitude',
                'custom_address',
            ]);
        });
    }

    /**
     * Renumber `order` to a 1..n run within each itinerary day. Safe to run on
     * a fresh database (no rows) and idempotent for already-normalised data.
     */
    private function backfillPositions(): void
    {
        $groups = DB::table('itinerary_items')
            ->select('itinerary_id', 'day_number')
            ->distinct()
            ->get();

        foreach ($groups as $group) {
            $ids = DB::table('itinerary_items')
                ->where('itinerary_id', $group->itinerary_id)
                ->where('day_number', $group->day_number)
                ->orderBy('order')
                ->orderBy('id')
                ->pluck('id');

            $position = 1;

            foreach ($ids as $id) {
                DB::table('itinerary_items')->where('id', $id)->update(['order' => $position]);
                $position++;
            }
        }
    }
};
