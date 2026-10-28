<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

#[Signature('db:export-json')]
#[Description('Export every application table to storage/app/backups/<timestamp>/<table>.json')]
class DbExportJsonCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $skip = ['migrations', 'cache', 'jobs', 'failed_jobs', 'sessions', 'password_reset_tokens'];
        $timestamp = now()->format('Y-m-d_His');
        $backupDir = storage_path('app/backups/'.$timestamp);
        File::ensureDirectoryExists($backupDir);

        $tables = [];
        try {
            $connection = DB::connection();
            if (method_exists($connection, 'getDoctrineSchemaManager')) {
                $tables = $connection->getDoctrineSchemaManager()->listTableNames();
            }
        } catch (\Throwable $e) {
        }
        if (empty($tables)) {
            $tables = collect(Schema::getTables())->pluck('name')->all();
        }

        $manifest = [
            'timestamp' => now()->toIso8601String(),
            'connection' => config('database.default'),
            'tables' => [],
        ];

        foreach ($tables as $table) {
            if (in_array($table, $skip, true)) {
                continue;
            }
            if (! Schema::hasTable($table)) {
                continue;
            }
            // Include soft-deleted rows
            $rows = DB::table($table)->get()->map(function ($row) {
                return (array) $row;
            })->all();

            $file = $backupDir.'/'.$table.'.json';
            File::put($file, json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $manifest['tables'][$table] = count($rows);
            $this->info($table.': '.count($rows));
        }

        File::put($backupDir.'/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info('Export complete to '.$backupDir);

        return self::SUCCESS;
    }
}
