<?php

namespace App\Console\Commands;

use App\Models\ItineraryInvite;
use Illuminate\Console\Command;

class PruneItineraryInvites extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'invites:prune';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete or revoke expired itinerary invites';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = ItineraryInvite::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        $this->info("Expired {$count} itinerary invites.");

        return self::SUCCESS;
    }
}
