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
        Schema::table('itineraries', function (Blueprint $table) {
            if (! Schema::hasColumn('itineraries', 'trip_type')) {
                $table->enum('trip_type', ['solo', 'group'])->default('solo')->after('is_template');
            }
            if (! Schema::hasColumn('itineraries', 'version')) {
                $table->unsignedInteger('version')->default(1)->after('trip_type');
            }
            if (! Schema::hasColumn('itineraries', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('version')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('itineraries', 'share_budget')) {
                $table->boolean('share_budget')->default(true)->after('updated_by');
            }
        });

        Schema::table('itinerary_user', function (Blueprint $table) {
            if (! Schema::hasColumn('itinerary_user', 'status')) {
                $table->enum('status', ['pending', 'accepted', 'declined'])->default('accepted')->after('role');
            }
            if (! Schema::hasColumn('itinerary_user', 'rsvp')) {
                $table->enum('rsvp', ['going', 'maybe', 'declined'])->nullable()->after('status');
            }
            if (! Schema::hasColumn('itinerary_user', 'invited_at')) {
                $table->timestamp('invited_at')->nullable()->after('invited_by');
            }
            if (! Schema::hasColumn('itinerary_user', 'responded_at')) {
                $table->timestamp('responded_at')->nullable()->after('invited_at');
            }
        });

        // Backfill: group trips where accepted members exist
        DB::statement("UPDATE itineraries SET trip_type = 'group' WHERE id IN (SELECT DISTINCT itinerary_id FROM itinerary_user WHERE status = 'accepted')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('itinerary_user', function (Blueprint $table) {
            if (Schema::hasColumn('itinerary_user', 'responded_at')) {
                $table->dropColumn('responded_at');
            }
            if (Schema::hasColumn('itinerary_user', 'invited_at')) {
                $table->dropColumn('invited_at');
            }
            if (Schema::hasColumn('itinerary_user', 'rsvp')) {
                $table->dropColumn('rsvp');
            }
            if (Schema::hasColumn('itinerary_user', 'status')) {
                $table->dropColumn('status');
            }
        });

        Schema::table('itineraries', function (Blueprint $table) {
            if (Schema::hasColumn('itineraries', 'share_budget')) {
                $table->dropColumn('share_budget');
            }
            if (Schema::hasColumn('itineraries', 'updated_by')) {
                $table->dropConstrainedForeignId('updated_by');
            }
            if (Schema::hasColumn('itineraries', 'version')) {
                $table->dropColumn('version');
            }
            if (Schema::hasColumn('itineraries', 'trip_type')) {
                $table->dropColumn('trip_type');
            }
        });
    }
};
