<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive trip lifecycle fields. Existing trips are backfilled as
     * "planned" so no destructive rewrite is needed.
     */
    public function up(): void
    {
        Schema::table('itineraries', function (Blueprint $table) {
            if (! Schema::hasColumn('itineraries', 'lifecycle_status')) {
                $table->string('lifecycle_status', 16)->default('planned')->after('trip_type');
                $table->index('lifecycle_status');
            }
            if (! Schema::hasColumn('itineraries', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('lifecycle_status');
            }
            if (! Schema::hasColumn('itineraries', 'paused_at')) {
                $table->timestamp('paused_at')->nullable()->after('started_at');
            }
            if (! Schema::hasColumn('itineraries', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('paused_at');
            }
            if (! Schema::hasColumn('itineraries', 'total_paused_seconds')) {
                $table->unsignedInteger('total_paused_seconds')->default(0)->after('completed_at');
            }
            if (! Schema::hasColumn('itineraries', 'distance_m')) {
                $table->unsignedInteger('distance_m')->default(0)->after('total_paused_seconds');
            }
            if (! Schema::hasColumn('itineraries', 'moving_seconds')) {
                $table->unsignedInteger('moving_seconds')->default(0)->after('distance_m');
            }
            if (! Schema::hasColumn('itineraries', 'started_by')) {
                $table->foreignId('started_by')->nullable()->after('moving_seconds')
                    ->constrained('users')->nullOnDelete();
            }
        });

        DB::table('itineraries')->whereNull('lifecycle_status')->update(['lifecycle_status' => 'planned']);
    }

    public function down(): void
    {
        Schema::table('itineraries', function (Blueprint $table) {
            if (Schema::hasColumn('itineraries', 'started_by')) {
                $table->dropConstrainedForeignId('started_by');
            }
            if (Schema::hasColumn('itineraries', 'moving_seconds')) {
                $table->dropColumn('moving_seconds');
            }
            if (Schema::hasColumn('itineraries', 'distance_m')) {
                $table->dropColumn('distance_m');
            }
            if (Schema::hasColumn('itineraries', 'total_paused_seconds')) {
                $table->dropColumn('total_paused_seconds');
            }
            if (Schema::hasColumn('itineraries', 'completed_at')) {
                $table->dropColumn('completed_at');
            }
            if (Schema::hasColumn('itineraries', 'paused_at')) {
                $table->dropColumn('paused_at');
            }
            if (Schema::hasColumn('itineraries', 'started_at')) {
                $table->dropColumn('started_at');
            }
            if (Schema::hasColumn('itineraries', 'lifecycle_status')) {
                $table->dropIndex(['lifecycle_status']);
                $table->dropColumn('lifecycle_status');
            }
        });
    }
};
