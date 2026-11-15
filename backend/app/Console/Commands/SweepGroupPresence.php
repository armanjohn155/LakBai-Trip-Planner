<?php

namespace App\Console\Commands;

use App\Services\GroupTrackingService;
use Illuminate\Console\Command;

class SweepGroupPresence extends Command
{
    protected $signature = 'tracking:sweep-presence';

    protected $description = 'Broadcast offline transitions for group members whose last ping is too old';

    public function handle(GroupTrackingService $group): int
    {
        $trips = $group->sweepPresence();

        $this->info("Swept presence for {$trips} active group trips.");

        return self::SUCCESS;
    }
}
