<?php

namespace App\Console\Commands;

use App\Models\Destination;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

#[Signature('destinations:import {path : Path to the backup JSON file}')]
#[Description('Restore destinations from a backup JSON file idempotently')]
class DestinationsImportCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $path = $this->argument('path');

        if (! File::exists($path)) {
            $this->error('File not found: '.$path);
            return self::FAILURE;
        }

        $content = File::get($path);
        $data = json_decode($content, true);

        if (! is_array($data)) {
            $this->error('Invalid JSON backup file.');
            return self::FAILURE;
        }

        $imported = 0;
        foreach ($data as $item) {
            if (! is_array($item)) {
                continue;
            }
            $name = $item['name'] ?? null;
            if (! $name) {
                continue;
            }

            $destination = Destination::withTrashed()->firstOrNew(['name' => $name]);
            // Preserve source/created_by if present; don't allow overwriting admin-created rows unexpectedly
            $fillable = [
                'description', 'category', 'region', 'municipality', 'latitude', 'longitude',
                'radius_m', 'estimated_cost', 'image_url', 'best_time_to_visit', 'tips',
                'rating', 'review_count', 'base_rating', 'base_review_count', 'lakbai_rating_avg', 'lakbai_review_count',
                'source', 'created_by',
            ];
            foreach ($fillable as $field) {
                if (array_key_exists($field, $item)) {
                    $destination->{$field} = $item[$field];
                }
            }
            if (isset($item['deleted_at']) && $item['deleted_at']) {
                $destination->deleted_at = $item['deleted_at'];
            } else {
                $destination->deleted_at = null;
            }
            $destination->save();
            $imported++;
        }

        $this->info('Imported/restored '.$imported.' destination(s) from '.$path);

        return self::SUCCESS;
    }
}
