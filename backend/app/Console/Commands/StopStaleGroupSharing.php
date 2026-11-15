<?php

namespace App\Console\Commands;

use App\Services\GroupTrackingService;
use Illuminate\Console\Command;

class StopStaleGroupSharing extends Command
{
    protected $signature = 'tracking:stop-stale-sharing';

    protected $description = 'Stop group sharing for sessions without a ping and prune expired meetup pins';

    public function handle(GroupTrackingService $group): int
    {
        $stopped = $group->stopStaleSharing();

        $this->info("Stopped sharing for {$stopped} stale tracking sessions.");

        return self::SUCCESS;
    }
}
