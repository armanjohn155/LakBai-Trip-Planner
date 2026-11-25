<?php

namespace App\Console\Commands;

use App\Models\Visit;
use App\Services\VisitDestinationLinker;
use Illuminate\Console\Command;

class LinkVisitDestinations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'visits:link-destinations
        {--apply : Write the links instead of only reporting them}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Link verified visits with a null destination to the one active destination that clearly contains them';

    /**
     * Execute the console command.
     */
    public function handle(VisitDestinationLinker $linker): int
    {
        $apply = (bool) $this->option('apply');

        $visits = Visit::query()
            ->verified()
            ->whereNull('destination_id')
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderBy('id')
            ->get();

        $linked = 0;
        $unmatched = 0;
        $skipped = 0;

        foreach ($visits as $visit) {
            if ($apply) {
                if ($linker->link($visit) !== null) {
                    $linked++;
                } else {
                    $skipped++;
                }

                continue;
            }

            if ($linker->match((float) $visit->latitude, (float) $visit->longitude) !== null) {
                $linked++;
            } else {
                $unmatched++;
            }
        }

        $this->info('Visit destination backfill');
        $this->line('Mode: '.($apply ? 'apply' : 'dry-run (no changes written)'));
        $this->newLine();

        $this->table(
            ['Metric', 'Count'],
            [
                ['Verified visits with no destination', $visits->count()],
                [$apply ? 'Linked' : 'Linkable', $linked],
                [$apply ? 'Skipped (ambiguous, out of range or cooldown)' : 'Unmatched (ambiguous or out of range)', $apply ? $skipped : $unmatched],
            ],
        );

        if (! $apply && $linked > 0) {
            $this->warn('Run again with --apply to write these links.');
        }

        return self::SUCCESS;
    }
}
