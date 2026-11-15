<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Shared with the group" is cleared when a trip is paused, finished or
 * cancelled. A recap still needs to know whether a traveller ever opted in,
 * so the route can include their recorded points without asking again.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tracking_sessions') || Schema::hasColumn('tracking_sessions', 'ever_shared_with_group')) {
            return;
        }

        Schema::table('tracking_sessions', function (Blueprint $table) {
            $table->boolean('ever_shared_with_group')->default(false)->after('shared_with_group');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('tracking_sessions', 'ever_shared_with_group')) {
            return;
        }

        Schema::table('tracking_sessions', function (Blueprint $table) {
            $table->dropColumn('ever_shared_with_group');
        });
    }
};
