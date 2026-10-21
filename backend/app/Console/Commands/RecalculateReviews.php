<?php

namespace App\Console\Commands;

use App\Services\ReviewStatsService;
use Illuminate\Console\Command;

class RecalculateReviews extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reviews:recalculate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Rebuild every destination\'s derived rating and review count from its visible reviews';

    /**
     * Execute the console command.
     */
    public function handle(ReviewStatsService $stats): int
    {
        $count = $stats->recalculateAll();

        $this->info("Recalculated ratings for {$count} destinations.");

        return self::SUCCESS;
    }
}
