<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('itineraries', 'trip_type')) {
            Schema::table('itineraries', function (Blueprint $table) {
                $table->string('trip_type', 16)->default('solo')->after('is_template');
            });
        }

        if (! Schema::hasColumn('itinerary_user', 'status')) {
            Schema::table('itinerary_user', function (Blueprint $table) {
                $table->string('status', 16)->default('accepted')->after('role');
            });
        }

        if (! Schema::hasColumn('itinerary_user', 'rsvp')) {
            Schema::table('itinerary_user', function (Blueprint $table) {
                $table->string('rsvp', 16)->nullable()->after('status');
            });
        }

        if (! Schema::hasColumn('itinerary_user', 'invited_at')) {
            Schema::table('itinerary_user', function (Blueprint $table) {
                $table->timestamp('invited_at')->nullable()->after('invited_by');
            });
        }

        if (! Schema::hasColumn('itinerary_user', 'responded_at')) {
            Schema::table('itinerary_user', function (Blueprint $table) {
                $table->timestamp('responded_at')->nullable()->after('invited_at');
            });
        }

        DB::table('itinerary_user')
            ->whereNull('status')
            ->update(['status' => 'accepted']);

        DB::table('itineraries')
            ->whereIn('id', function ($query) {
                $query->select('itinerary_id')
                    ->from('itinerary_user')
                    ->where('status', 'accepted');
            })
            ->update(['trip_type' => 'group']);
    }

    public function down(): void
    {
    }
};
