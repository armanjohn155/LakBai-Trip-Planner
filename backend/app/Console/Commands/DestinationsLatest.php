<?php

namespace App\Console\Commands;

use App\Models\Destination;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DestinationsLatest extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'destinations:latest {--limit=5 : Number of destinations to display}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Show the latest destinations from the active database connection';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $connection = DB::connection();

        $this->line('Connection driver: '.$connection->getDriverName());
        $this->line('Database name: '.($connection->getDatabaseName() ?? '(unknown)'));
        $this->newLine();

        $destinations = Destination::query()
            ->withTrashed()
            ->latest('id')
            ->limit($limit)
            ->get(['id', 'name', 'category', 'region', 'source', 'created_at']);

        if ($destinations->isEmpty()) {
            $this->info('No destinations found.');

            return self::SUCCESS;
        }

        $this->table(
            ['ID', 'Name', 'Category', 'Region', 'Source', 'Created at'],
            $destinations->map(fn (Destination $destination) => [
                $destination->id,
                $destination->name,
                $destination->category,
                $destination->region,
                $destination->source ?? '-',
                $destination->created_at?->toDateTimeString() ?? '-',
            ])->all()
        );

        return self::SUCCESS;
    }
}
