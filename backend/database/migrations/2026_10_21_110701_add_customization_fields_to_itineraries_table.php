<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive customization fields for itineraries. Existing rows keep working:
     * every column is nullable or has a default.
     */
    public function up(): void
    {
        Schema::table('itineraries', function (Blueprint $table) {
            $table->text('description')->nullable()->after('title');
            $table->decimal('total_budget', 10, 2)->nullable()->after('budget');
            $table->string('cover_image_url')->nullable()->after('total_budget');
            $table->boolean('is_template')->default(false)->after('cover_image_url');
            $table->string('template_key')->nullable()->after('is_template');

            $table->index('is_template');
            $table->index('template_key');
        });
    }

    public function down(): void
    {
        Schema::table('itineraries', function (Blueprint $table) {
            $table->dropIndex(['is_template']);
            $table->dropIndex(['template_key']);
            $table->dropColumn([
                'description',
                'total_budget',
                'cover_image_url',
                'is_template',
                'template_key',
            ]);
        });
    }
};
