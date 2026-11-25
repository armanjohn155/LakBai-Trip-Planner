<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Custom trip stops can now produce a verified visit before a matching
     * destination is known, and a GPS check-in can supersede an earlier manual
     * visit instead of leaving two entries in the traveller's history.
     */
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->foreignId('destination_id')->nullable()->change();
        });

        Schema::table('visits', function (Blueprint $table) {
            if (! Schema::hasColumn('visits', 'superseded_at')) {
                $table->timestamp('superseded_at')->nullable()->after('visited_at');
            }

            if (! Schema::hasColumn('visits', 'superseded_by_visit_id')) {
                $table->foreignId('superseded_by_visit_id')
                    ->nullable()
                    ->after('superseded_at')
                    ->constrained('visits')
                    ->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            if (Schema::hasColumn('visits', 'superseded_by_visit_id')) {
                $table->dropConstrainedForeignId('superseded_by_visit_id');
            }

            if (Schema::hasColumn('visits', 'superseded_at')) {
                $table->dropColumn('superseded_at');
            }
        });

        // Only restore the NOT NULL constraint when no unlinked history exists;
        // deleting a traveller's visit just to make a rollback pass is worse.
        if (! DB::table('visits')->whereNull('destination_id')->exists()) {
            Schema::table('visits', function (Blueprint $table) {
                $table->unsignedBigInteger('destination_id')->nullable(false)->change();
            });
        }
    }
};
