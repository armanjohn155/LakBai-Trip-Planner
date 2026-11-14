<?php

namespace App\Console\Commands;

use App\Services\TripTrackingService;
use Illuminate\Console\Command;

class PruneTrackingPoints extends Command
{
    protected $signature = 'tracking:prune
        {--days= : Delete raw points older than this many days}';

    protected $description = 'Delete raw GPS points for finished trips past the retention window';

    public function handle(TripTrackingService $tracking): int
    {
        $days = $this->option('days') !== null ? (int) $this->option('days') : null;
        $deleted = $tracking->prunePoints($days);

        $this->info("Pruned {$deleted} tracking points.");

        return self::SUCCESS;
    }
}
