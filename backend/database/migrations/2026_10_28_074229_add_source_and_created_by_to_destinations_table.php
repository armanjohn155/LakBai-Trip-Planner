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
            $table->string('source')->default('seeded')->after('tips');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete()->after('source');
        });

        // Backfill existing rows as seeded (admin-created rows will be marked explicitly going forward)
        DB::table('destinations')->whereNull('source')->orWhere('source', '')->update(['source' => 'seeded']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('destinations', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn(['created_by', 'source']);
        });
    }
};
