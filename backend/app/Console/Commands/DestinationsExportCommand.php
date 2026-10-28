<?php

namespace App\Console\Commands;

use App\Models\Destination;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

#[Signature('destinations:export {--path= : Custom path to save the backup}')]
#[Description('Dump all destinations (including admin-created) to a JSON backup file in storage/app/backups/')]
class DestinationsExportCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $destinations = Destination::withTrashed()->get()->map(function (Destination $destination) {
            return $destination->toArray();
        })->all();

        $backupDir = storage_path('app/backups');
        File::ensureDirectoryExists($backupDir);

        $filename = $this->option('path');
        if ($filename) {
            $path = str_contains($filename, DIRECTORY_SEPARATOR) || str_starts_with($filename, $backupDir)
                ? $filename
                : $backupDir.DIRECTORY_SEPARATOR.$filename;
        } else {
            $path = $backupDir.DIRECTORY_SEPARATOR.'destinations-backup-'.now()->format('Y-m-d_His').'.json';
        }

        File::put($path, json_encode($destinations, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->info('Exported '.count($destinations).' destination(s) to '.$path);

        return self::SUCCESS;
    }
}
