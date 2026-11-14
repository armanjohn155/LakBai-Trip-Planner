<?php

namespace App\Console\Commands;

use App\Services\TripLifecycleService;
use Illuminate\Console\Command;

class ExpireStaleTrips extends Command
{
    protected $signature = 'trips:expire-stale';

    protected $description = 'Pause trips with no tracking points for too long and cancel long-paused trips';

    public function handle(TripLifecycleService $lifecycle): int
    {
        $result = $lifecycle->expireStale();

        $this->info("Paused {$result['paused']} stale trips and cancelled {$result['cancelled']} long-paused trips.");

        return self::SUCCESS;
    }
}
