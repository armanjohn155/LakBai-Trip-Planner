<?php

namespace App\Services;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Models\TrackingPoint;
use App\Models\TrackingSession;
use App\Models\TripRecap;
use App\Models\Visit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Builds the durable recap for a completed trip: stats plus a simplified
 * route. The result is stored on trip_recaps so raw points can later be
 * pruned without losing the memory.
 */
class TripRecapBuilder
{
    public function __construct(private readonly RouteSimplifier $simplifier) {}

    public function ensure(Itinerary $itinerary): TripRecap
    {
        $recap = TripRecap::query()->firstOrCreate(
            ['itinerary_id' => $itinerary->id],
            [
                'title' => $itinerary->title,
                'visibility' => TripRecap::VISIBILITY_PRIVATE,
                'hide_endpoints' => true,
                'show_stats' => true,
                'show_photos' => true,
            ],
        );

        if ($recap->title === '' || $recap->title === null) {
            $recap->forceFill(['title' => $itinerary->title])->save();
        }

        return $recap;
    }

    /**
     * Recompute and persist stats and the simplified route.
     */
    public function build(Itinerary $itinerary): TripRecap
    {
        $itinerary->loadMissing(['items.destination' => fn ($query) => $query->withTrashed()]);

        $recap = $this->ensure($itinerary);

        $sessions = TrackingSession::query()
            ->where('itinerary_id', $itinerary->id)
            ->with(['points' => fn ($query) => $query->orderBy('recorded_at')])
            ->get();

        $included = $this->includedSessions($itinerary, $sessions);
        $route = $this->buildRoute($itinerary, $included);

        $recap->forceFill([
            'route_geojson' => $route,
            'stats' => $this->buildStats($itinerary, $included),
        ])->save();

        if ($recap->title === null || $recap->title === '') {
            $recap->forceFill(['title' => $itinerary->title])->save();
        }

        return $recap->refresh();
    }

    /**
     * The owner's route is always included; anyone else only if they opted
     * in to group sharing at least once during the trip.
     *
     * @param  Collection<int, TrackingSession>  $sessions
     * @return Collection<int, TrackingSession>
     */
    private function includedSessions(Itinerary $itinerary, Collection $sessions): Collection
    {
        return $sessions
            ->filter(fn (TrackingSession $session) => (int) $session->user_id === (int) $itinerary->user_id
                || (bool) $session->ever_shared_with_group
                || (bool) $session->shared_with_group)
            ->values();
    }

    /**
     * @param  Collection<int, TrackingSession>  $sessions
     * @return array{type: string, features: array<int, array<string, mixed>>}
     */
    private function buildRoute(Itinerary $itinerary, Collection $sessions): array
    {
        $features = [];
        $sequence = 0;

        foreach ($sessions as $session) {
            $sequence++;
            $points = $session->points
                ->filter(fn (TrackingPoint $point) => $point->lat !== null && $point->lng !== null)
                ->values();

            if ($points->count() < 2) {
                continue;
            }

            foreach ($this->groupByDay($itinerary, $points) as $day => $dayPoints) {
                $simplified = $this->simplifier->simplify($dayPoints);

                if (count($simplified) < 2) {
                    continue;
                }

                $features[] = [
                    'type' => 'Feature',
                    'properties' => [
                        'day' => $day,
                        'sequence' => $sequence,
                        'point_count' => count($simplified),
                    ],
                    'geometry' => [
                        'type' => 'LineString',
                        'coordinates' => array_map(
                            fn (array $point) => [round($point[1], 7), round($point[0], 7)],
                            $simplified,
                        ),
                    ],
                ];
            }
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /**
     * @param  Collection<int, TrackingPoint>  $points
     * @return array<int, array<int, array{0: float, 1: float}>>
     */
    private function groupByDay(Itinerary $itinerary, Collection $points): array
    {
        $dayCount = max(1, $itinerary->dayCount());
        $start = $itinerary->start_date?->copy()->startOfDay();
        $groups = [];

        foreach ($points as $point) {
            $day = 1;

            if ($start !== null && $point->recorded_at !== null) {
                $day = (int) $start->diffInDays($point->recorded_at->copy()->startOfDay(), false) + 1;
                $day = max(1, min($dayCount, $day));
            }

            $groups[$day][] = [(float) $point->lat, (float) $point->lng];
        }

        ksort($groups);

        return $groups;
    }

    /**
     * @param  Collection<int, TrackingSession>  $sessions
     * @return array<string, mixed>
     */
    private function buildStats(Itinerary $itinerary, Collection $sessions): array
    {
        $items = $itinerary->items;
        $itemIds = $items->pluck('id')->all();

        $distance = (int) round((float) $sessions->sum('distance_m'));

        if ($distance <= 0) {
            $distance = (int) $itinerary->distance_m;
        }

        $moving = (int) $itinerary->moving_seconds;
        $elapsed = $this->elapsedSeconds($itinerary);

        $verifiedVisits = $itemIds === []
            ? 0
            : Visit::query()
                ->whereIn('itinerary_stop_id', $itemIds)
                ->where('verified', true)
                ->count();

        $plannedSpend = (float) $items->sum(fn (ItineraryItem $item) => (float) ($item->estimated_budget ?? 0));
        $visitedSpend = (float) $items
            ->where('status', 'done')
            ->sum(fn (ItineraryItem $item) => (float) ($item->estimated_budget ?? 0));

        $speed = $moving > 0
            ? round(($distance / $moving) * 3.6, 1)
            : ($elapsed > 0 ? round(($distance / $elapsed) * 3.6, 1) : 0.0);

        return [
            'distance_m' => $distance,
            'moving_seconds' => $moving,
            'elapsed_seconds' => $elapsed,
            'days' => max(1, $itinerary->dayCount()),
            'stops_total' => $items->count(),
            'stops_visited' => $items->where('status', 'done')->count(),
            'stops_skipped' => $items->where('status', 'skipped')->count(),
            'verified_visits' => $verifiedVisits,
            'spend_planned' => round($plannedSpend, 2),
            'spend_estimated' => round($visitedSpend, 2),
            'average_speed_kmh' => $speed,
            'travellers' => $sessions->pluck('user_id')->unique()->count(),
        ];
    }

    private function elapsedSeconds(Itinerary $itinerary): int
    {
        if ($itinerary->started_at === null) {
            return 0;
        }

        $end = $itinerary->completed_at ?? Carbon::now();
        $elapsed = $end->getTimestamp() - $itinerary->started_at->getTimestamp() - (int) $itinerary->total_paused_seconds;

        return max(0, $elapsed);
    }
}
