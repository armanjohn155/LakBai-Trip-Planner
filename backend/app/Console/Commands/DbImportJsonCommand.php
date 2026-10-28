<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

#[Signature('db:import-json {path : Path to export directory containing manifest.json} {--force : Force import even if tables not empty or in production}')]
#[Description('Import JSON backups in dependency order preserving IDs')]
class DbImportJsonCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $path = rtrim($this->argument('path'), DIRECTORY_SEPARATOR);
        $manifestPath = $path.'/manifest.json';
        if (! File::exists($manifestPath)) {
            $this->error('manifest.json not found in '.$path);
            return self::FAILURE;
        }

        $force = (bool) $this->option('force');

        if (App::environment('production') && ! $force) {
            $this->error('Refusing to run on production without --force');
            return self::FAILURE;
        }

        $manifest = json_decode(File::get($manifestPath), true);

        $skip = ['migrations', 'cache', 'jobs', 'failed_jobs', 'sessions', 'password_reset_tokens'];
        $tables = array_keys($manifest['tables'] ?? []);
        // Dependency order
        $order = [
            'users',
            'destinations',
            'itineraries',
            'itinerary_items',
            'itinerary_user',
            'itinerary_invites',
            'itinerary_activities',
            'visits',
            'reviews',
            'review_photos',
            'review_reports',
            'favorites',
            'friendships',
            'user_settings',
            'notifications',
            'notification_preferences',
            'personal_access_tokens',
        ];
        $sorted = [];
        foreach ($order as $t) {
            if (in_array($t, $tables, true) && ! in_array($t, $skip, true)) {
                $sorted[] = $t;
            }
        }
        foreach ($tables as $t) {
            if (! in_array($t, $skip, true) && ! in_array($t, $sorted, true)) {
                $sorted[] = $t;
            }
        }

        // Check if target tables are empty
        if (! $force) {
            foreach ($sorted as $table) {
                if (Schema::hasTable($table) && DB::table($table)->count() > 0) {
                    $this->error('Target table '.$table.' is not empty. Use --force to override.');
                    return self::FAILURE;
                }
            }
        }

        DB::beginTransaction();
        try {
            $driver = DB::getDriverName();
            foreach ($sorted as $table) {
                if (in_array($table, $skip, true)) {
                    continue;
                }
                $file = $path.'/'.$table.'.json';
                if (! File::exists($file)) {
                    continue;
                }
                $rows = json_decode(File::get($file), true);
                if (! is_array($rows) || empty($rows)) {
                    continue;
                }
                // Insert in chunks preserving IDs
                $chunks = array_chunk($rows, 500);
                foreach ($chunks as $chunk) {
                    DB::table($table)->insert($chunk);
                }
                $this->info('Imported '.$table.': '.count($rows));
            }

            // Reset sequences on PostgreSQL
            if ($driver === 'pgsql') {
                foreach ($sorted as $table) {
                    if (in_array($table, $skip, true)) {
                        continue;
                    }
                    if (! Schema::hasTable($table)) {
                        continue;
                    }
                    if (! Schema::hasColumn($table, 'id')) {
                        continue;
                    }
                    try {
                        $seq = DB::select("SELECT pg_get_serial_sequence(?, 'id') as seq", [$table]);
                        $seqName = $seq[0]->seq ?? null;
                        if ($seqName) {
                            DB::statement("SELECT setval('$seqName', COALESCE((SELECT MAX(id) FROM \"$table\"), 1), (SELECT MAX(id) IS NOT NULL FROM \"$table\"))");
                        }
                    } catch (\Throwable $e) {
                        // ignore
                    }
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        // Compare counts
        foreach ($sorted as $table) {
            if (in_array($table, $skip, true)) {
                continue;
            }
            $expected = $manifest['tables'][$table] ?? null;
            if ($expected === null) {
                continue;
            }
            $actual = Schema::hasTable($table) ? DB::table($table)->count() : 0;
            if ((int) $actual !== (int) $expected) {
                $this->error("Count mismatch for {$table}: expected {$expected}, got {$actual}");
                return self::FAILURE;
            }
        }

        $this->info('Import complete and counts match.');

        return self::SUCCESS;
    }
}
