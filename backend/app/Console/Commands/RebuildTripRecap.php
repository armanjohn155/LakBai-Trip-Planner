<?php

namespace App\Console\Commands;

use App\Models\Itinerary;
use App\Services\TripRecapBuilder;
use Illuminate\Console\Command;

class RebuildTripRecap extends Command
{
    protected $signature = 'trips:rebuild-recap {itinerary : Itinerary id}';

    protected $description = 'Recompute a trip recap route and statistics from stored tracking points';

    public function handle(TripRecapBuilder $builder): int
    {
        $itinerary = Itinerary::query()->find($this->argument('itinerary'));

        if ($itinerary === null) {
            $this->error('Itinerary not found.');

            return self::FAILURE;
        }

        $recap = $builder->build($itinerary);

        $features = count($recap->route_geojson['features'] ?? []);

        $this->info("Rebuilt recap {$recap->id} with {$features} route features.");

        return self::SUCCESS;
    }
}
