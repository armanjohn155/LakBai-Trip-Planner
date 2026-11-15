<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Services\RouteEstimator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Throwable;

class ItineraryRouteEstimateController extends Controller
{
    public function __construct(private readonly RouteEstimator $estimator) {}

    /**
     * Travel-time estimates between consecutive stops, per day.
     *
     * Best-effort: any failure yields an empty/failed segment rather than an
     * error, so the itinerary page is never blocked.
     */
    public function show(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $itinerary->load(['items.destination' => fn ($query) => $query->withTrashed()]);

        $days = $itinerary->items
            ->groupBy('day_number')
            ->sortKeys()
            ->map(fn ($items, $day) => [
                'day_number' => (int) $day,
                'legs' => $this->legsForDay($items->values()),
            ])
            ->values();

        return response()->json([
            'data' => [
                'enabled' => $this->estimator->enabled(),
                'days' => $days,
            ],
        ]);
    }

    /**
     * @param  Collection<int, ItineraryItem>  $items
     * @return array<int, array<string, mixed>>
     */
    private function legsForDay($items): array
    {
        if (! $this->estimator->enabled()) {
            return [];
        }

        $legs = [];
        for ($index = 0; $index < $items->count() - 1; $index++) {
            $legs[$index] = [
                'from_stop_id' => $items[$index]->id,
                'to_stop_id' => $items[$index + 1]->id,
                'distance_m' => null,
                'duration_s' => null,
                'source' => null,
            ];
        }

        // Route contiguous coordinate runs in chunks instead of issuing one
        // network request for each pair. Consecutive chunks share an endpoint.
        $run = [];
        $runStart = 0;
        $flushRun = function () use (&$run, &$runStart, &$legs): void {
            for ($start = 0; $start < count($run) - 1; $start += 24) {
                $chunk = array_slice($run, $start, 25);
                if (count($chunk) < 2) break;
                try {
                    $result = $this->estimator->route(array_map(fn ($point) => [
                        'lat' => $point[0], 'lng' => $point[1],
                    ], $chunk));
                    foreach ($result['legs'] as $offset => $segment) {
                        $legIndex = $runStart + $start + $offset;
                        if (! isset($legs[$legIndex])) continue;
                        $legs[$legIndex]['distance_m'] = $segment['distance_m'];
                        $legs[$legIndex]['duration_s'] = $segment['duration_s'];
                        $legs[$legIndex]['source'] = $result['approximate'] ? 'haversine' : $result['provider'];
                    }
                } catch (Throwable) {
                    // Best-effort estimates must never block the itinerary page.
                }
            }
            $run = [];
        };

        foreach ($items as $index => $item) {
            $coords = $item->resolvedCoordinates();
            if ($coords === null) {
                $flushRun();
                $runStart = $index + 1;
                continue;
            }
            if ($run === []) $runStart = $index;
            $run[] = $coords;
        }
        $flushRun();

        return array_values($legs);
    }
}
