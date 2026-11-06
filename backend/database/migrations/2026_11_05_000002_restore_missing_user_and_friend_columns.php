<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('username')->nullable()->unique()->after('name');
            });
        }

        if (! Schema::hasColumn('users', 'friend_code')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('friend_code')->nullable()->unique()->after('username');
            });
        }

        if (! Schema::hasColumn('users', 'friend_code_regenerated_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('friend_code_regenerated_at')->nullable()->after('friend_code');
            });
        }

        if (Schema::hasTable('friendships')) {
            if (! Schema::hasColumn('friendships', 'requester_id')) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->foreignId('requester_id')->nullable()->constrained('users')->cascadeOnDelete();
                });
            }

            if (! Schema::hasColumn('friendships', 'addressee_id')) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->foreignId('addressee_id')->nullable()->constrained('users')->cascadeOnDelete();
                });
            }

            if (! Schema::hasColumn('friendships', 'status')) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->string('status', 16)->default('pending');
                });
            }

            if (! Schema::hasColumn('friendships', 'blocked_by')) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->foreignId('blocked_by')->nullable()->constrained('users')->nullOnDelete();
                });
            }

            if (! Schema::hasColumn('friendships', 'responded_at')) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->timestamp('responded_at')->nullable();
                });
            }

            $indexes = collect(Schema::getIndexes('friendships'))->pluck('name')->all();

            if (! in_array('friendships_requester_id_addressee_id_unique', $indexes, true)) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->unique(['requester_id', 'addressee_id']);
                });
            }

            if (! in_array('friendships_addressee_id_status_index', $indexes, true)) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->index(['addressee_id', 'status']);
                });
            }

            if (! in_array('friendships_requester_id_status_index', $indexes, true)) {
                Schema::table('friendships', function (Blueprint $table) {
                    $table->index(['requester_id', 'status']);
                });
            }
        }
    }

    public function down(): void
    {
    }
};
