<?php

namespace App\Console\Commands;

use App\Models\ItineraryInvite;
use Illuminate\Console\Command;

class PruneInviteLinks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'invite-links:prune';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Revoke expired share-link invites';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = ItineraryInvite::query()
            ->where('type', 'link')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        $this->info("Revoked {$count} expired invite links.");

        return self::SUCCESS;
    }
}
