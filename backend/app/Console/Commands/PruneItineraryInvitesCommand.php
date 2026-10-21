<?php

namespace App\Console\Commands;

use App\Models\ItineraryInvite;
use Illuminate\Console\Command;

class PruneItineraryInvitesCommand extends Command
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
    protected $description = 'Prune expired or exhausted itinerary invites';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $count = ItineraryInvite::query()
            ->where(function ($query) {
                $query->whereNotNull('revoked_at')
                    ->orWhere(fn ($q) => $q->whereNotNull('expires_at')->where('expires_at', '<', now()))
                    ->orWhere(fn ($q) => $q->whereNotNull('max_uses')->whereColumn('uses_count', '>=', 'max_uses'));
            })
            ->delete();

        $this->info("Pruned {$count} invite(s).");

        return self::SUCCESS;
    }
}
