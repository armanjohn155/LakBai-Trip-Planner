<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Group live tracking is opt-in per traveller. The owner can never turn it
     * on for somebody else, so the default is always false.
     */
    public function up(): void
    {
        Schema::table('tracking_sessions', function (Blueprint $table) {
            $table->boolean('shared_with_group')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('tracking_sessions', function (Blueprint $table) {
            $table->dropColumn('shared_with_group');
        });
    }
};
