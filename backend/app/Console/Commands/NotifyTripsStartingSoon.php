<?php

namespace App\Console\Commands;

use App\Models\Itinerary;
use App\Notifications\TripStartingSoonNotification;
use App\Services\NotificationDispatcher;
use Illuminate\Console\Command;

class NotifyTripsStartingSoon extends Command
{
    protected $signature = 'trips:notify-starting-soon {--days= : How many days ahead counts as "soon"}';

    protected $description = 'Send one starting-soon notification per member per trip';

    public function handle(NotificationDispatcher $notifications): int
    {
        $days = (int) ($this->option('days') ?? config('lakbai.notifications.starting_soon_days', 2));
        $today = now()->startOfDay();
        $until = $today->copy()->addDays($days);

        $trips = Itinerary::query()
            ->where('is_template', false)
            ->whereDate('start_date', '>=', $today->toDateString())
            ->whereDate('start_date', '<=', $until->toDateString())
            ->with(['user', 'acceptedMembers'])
            ->get();

        $sent = 0;

        foreach ($trips as $trip) {
            foreach ($notifications->tripRecipients($trip) as $recipient) {
                if ($notifications->startingSoonAlreadySent($recipient, $trip)) {
                    continue;
                }

                $recipient->notify(new TripStartingSoonNotification($trip));
                $sent++;
            }
        }

        $this->info("Sent {$sent} starting-soon notifications for {$trips->count()} trips.");

        return self::SUCCESS;
    }
}
