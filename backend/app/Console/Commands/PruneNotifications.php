<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Notifications\DatabaseNotification;

class PruneNotifications extends Command
{
    protected $signature = 'notifications:prune
        {--read-days= : Delete read notifications older than this many days}
        {--all-days= : Delete any notification older than this many days}';

    protected $description = 'Delete old read notifications and anything beyond the retention window';

    public function handle(): int
    {
        $readDays = (int) ($this->option('read-days') ?? config('lakbai.notifications.prune_read_days', 30));
        $allDays = (int) ($this->option('all-days') ?? config('lakbai.notifications.prune_all_days', 90));

        $read = DatabaseNotification::query()
            ->whereNotNull('read_at')
            ->where('read_at', '<', now()->subDays($readDays))
            ->delete();

        $all = DatabaseNotification::query()
            ->where('created_at', '<', now()->subDays($allDays))
            ->delete();

        $this->info("Pruned {$read} read notifications and {$all} expired notifications.");

        return self::SUCCESS;
    }
}
