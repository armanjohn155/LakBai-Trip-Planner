<?php

namespace App\Services;

/**
 * Small, dependency-free geometry helpers for recaps.
 *
 * Points use [lat, lng] in this class; the builder converts to GeoJSON's
 * [lng, lat] order at the edge. Distances are metres on a spherical Earth.
 */
class RouteSimplifier
{
    private const EARTH_RADIUS_M = 6371000.0;

    public function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * self::EARTH_RADIUS_M * asin(min(1.0, sqrt($a)));
    }

    /**
     * Ramer-Douglas-Peucker simplification with an iterative stack so long
     * routes never hit the recursion limit.
     *
     * @param  array<int, array{0: float, 1: float}>  $points
     * @return array<int, array{0: float, 1: float}>
     */
    public function simplify(array $points, ?float $toleranceMeters = null): array
    {
        $tolerance = $toleranceMeters ?? (float) config('lakbai.recap.simplify_tolerance_m', 15);
        $count = count($points);

        if ($count <= 2) {
            return array_values($points);
        }

        $keep = [0 => true, $count - 1 => true];
        $stack = [[0, $count - 1]];

        while ($stack !== []) {
            [$first, $last] = array_pop($stack);

            if ($last - $first <= 1) {
                continue;
            }

            $maxDistance = 0.0;
            $maxIndex = $first;

            for ($i = $first + 1; $i < $last; $i++) {
                $distance = $this->perpendicularMeters($points[$i], $points[$first], $points[$last]);

                if ($distance > $maxDistance) {
                    $maxDistance = $distance;
                    $maxIndex = $i;
                }
            }

            if ($maxDistance > $tolerance) {
                $keep[$maxIndex] = true;
                $stack[] = [$first, $maxIndex];
                $stack[] = [$maxIndex, $last];
            }
        }

        ksort($keep);

        return array_values(array_map(fn (int $index) => $points[$index], array_keys($keep)));
    }

    /**
     * Drop the first and last N metres of a route so public links do not
     * reveal a home or hotel. Returns an empty route when it is too short to
     * leave a meaningful middle section.
     *
     * @param  array<int, array{0: float, 1: float}>  $points
     * @return array<int, array{0: float, 1: float}>
     */
    public function trimEnds(array $points, ?float $radiusMeters = null): array
    {
        $radius = $radiusMeters ?? (float) config('lakbai.recap.privacy_radius_m', 300);
        $count = count($points);

        if ($count < 3 || $radius <= 0) {
            return array_values($points);
        }

        $start = null;
        $travelled = 0.0;

        for ($i = 1; $i < $count; $i++) {
            $travelled += $this->haversineMeters(
                $points[$i - 1][0], $points[$i - 1][1],
                $points[$i][0], $points[$i][1],
            );

            if ($travelled >= $radius) {
                $start = $i;
                break;
            }
        }

        if ($start === null) {
            return [];
        }

        $end = null;
        $travelled = 0.0;

        for ($i = $count - 2; $i >= $start; $i--) {
            $travelled += $this->haversineMeters(
                $points[$i + 1][0], $points[$i + 1][1],
                $points[$i][0], $points[$i][1],
            );

            if ($travelled >= $radius) {
                $end = $i;
                break;
            }
        }

        if ($end === null || $end - $start + 1 < 2) {
            return [];
        }

        return array_values(array_slice($points, $start, $end - $start + 1));
    }

    /**
     * Perpendicular distance from a point to a line segment, in metres,
     * using an equirectangular projection centred on the segment start.
     *
     * @param  array{0: float, 1: float}  $point
     * @param  array{0: float, 1: float}  $start
     * @param  array{0: float, 1: float}  $end
     */
    private function perpendicularMeters(array $point, array $start, array $end): float
    {
        $latScale = deg2rad(1) * self::EARTH_RADIUS_M;

        $px = deg2rad($point[1] - $start[1]) * cos(deg2rad($start[0])) * self::EARTH_RADIUS_M;
        $py = deg2rad($point[0] - $start[0]) * $latScale;

        $ex = deg2rad($end[1] - $start[1]) * cos(deg2rad($start[0])) * self::EARTH_RADIUS_M;
        $ey = deg2rad($end[0] - $start[0]) * $latScale;

        $lengthSquared = $ex * $ex + $ey * $ey;

        if ($lengthSquared <= 0.0) {
            return sqrt($px * $px + $py * $py);
        }

        $t = max(0.0, min(1.0, ($px * $ex + $py * $ey) / $lengthSquared));

        $dx = $px - $t * $ex;
        $dy = $py - $t * $ey;

        return sqrt($dx * $dx + $dy * $dy);
    }
}
