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

        for ($i = 0; $i < $items->count() - 1; $i++) {
            $from = $items[$i];
            $to = $items[$i + 1];

            $fromCoords = $from->resolvedCoordinates();
            $toCoords = $to->resolvedCoordinates();

            $leg = [
                'from_stop_id' => $from->id,
                'to_stop_id' => $to->id,
                'distance_m' => null,
                'duration_s' => null,
                'source' => null,
            ];

            if ($fromCoords !== null && $toCoords !== null) {
                try {
                    $estimate = $this->estimator->estimate(
                        $fromCoords[0],
                        $fromCoords[1],
                        $toCoords[0],
                        $toCoords[1],
                    );

                    $leg['distance_m'] = $estimate['distance_m'];
                    $leg['duration_s'] = $estimate['duration_s'];
                    $leg['source'] = $estimate['source'];
                } catch (Throwable) {
                    // Swallow: an estimate failure must never break the response.
                }
            }

            $legs[] = $leg;
        }

        return $legs;
    }
}
