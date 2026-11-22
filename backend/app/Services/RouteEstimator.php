<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Client\RequestException;
use Throwable;

/** Best-effort routing with cached road geometry and an honest straight-line fallback. */
class RouteEstimator
{
    private const EARTH_RADIUS_M = 6371000.0;

    public function __construct(
        private readonly bool $enabled = false,
        private readonly string $osrmUrl = 'https://router.project-osrm.org',
        private readonly int $timeout = 4,
        private readonly int $cacheTtl = 86400,
        private readonly float $fallbackSpeedKmh = 30.0,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            enabled: (bool) config('lakbai.routing.enabled', true),
            osrmUrl: (string) config('lakbai.routing.osrm_url', 'https://router.project-osrm.org'),
            timeout: (int) config('lakbai.routing.timeout', 4),
            cacheTtl: (int) config('lakbai.routing.cache_ttl', 86400),
            fallbackSpeedKmh: (float) config('lakbai.routing.fallback_speed_kmh', 30),
        );
    }

    public function enabled(): bool
    {
        return $this->enabled;
    }

    /**
     * @param array<int, array{lat: float, lng: float}> $waypoints
     * @return array{geometry: array{type: string, coordinates: array<int, array{float, float}>}, distance_m: int, duration_s: int, legs: array<int, array{distance_m: int, duration_s: int}>, provider: string, approximate: bool, reason?: string}
     */
    public function route(array $waypoints, string $profile = 'driving'): array
    {
        $provider = (string) config('lakbai.routing.provider', 'osrm');
        $rounded = array_map(fn ($point) => [round((float) $point['lat'], 4), round((float) $point['lng'], 4)], $waypoints);
        $key = 'lakbai.route.'.hash('sha256', json_encode([$provider, $profile, $rounded], JSON_THROW_ON_ERROR));

        $cached = Cache::get($key);
        if (is_array($cached)) return $cached;

        $result = (function () use ($provider, $profile, $waypoints) {
            if (! $this->enabled) {
                return $this->fallback($waypoints, 'provider_unavailable', $profile);
            }

            $breakerKey = "lakbai.routing.breaker.{$provider}";
            if (Cache::has($breakerKey)) {
                return $this->fallback($waypoints, 'provider_unavailable', $profile);
            }

            try {
                $route = $this->makeProvider($provider)->route($waypoints, $profile);
            } catch (Throwable $error) {
                $failuresKey = "lakbai.routing.failures.{$provider}";
                Cache::add($failuresKey, 0, 60);
                $failures = (int) Cache::increment($failuresKey);
                $breakerSeconds = max(1, (int) config('lakbai.routing.circuit_breaker_seconds', 60));
                if ($failures >= 3) Cache::put($breakerKey, true, $breakerSeconds);
                $rateLimited = $error->getMessage() === 'rate_limited'
                    || ($error instanceof RequestException && $error->response?->status() === 429);
                return $this->fallback($waypoints, $rateLimited ? 'rate_limited' : 'provider_unavailable', $profile);
            }

            Cache::forget("lakbai.routing.failures.{$provider}");
            if ($route === null) return $this->fallback($waypoints, 'no_road_route', $profile);

            $straight = $this->straightDistance($waypoints);
            if ($straight > 0 && $route['distance_m'] > $straight * 4) {
                return $this->fallback($waypoints, 'no_road_route', $profile);
            }

            $tolerance = (float) config('lakbai.routing.simplify_tolerance_m', 5);
            $route['geometry']['coordinates'] = $this->simplify($route['geometry']['coordinates'], $tolerance);
            return $route + ['provider' => $provider, 'approximate' => false];
        })();
        if (($result['approximate'] ?? false)
            && in_array($result['reason'] ?? '', ['provider_unavailable', 'rate_limited'], true)) {
            return $result;
        }
        $ttl = ($result['approximate'] ?? false) && ($result['reason'] ?? '') !== 'no_road_route'
            ? 60
            : max(1, $this->cacheTtl);
        Cache::put($key, $result, $ttl);
        return $result;
    }

    /** Legacy adjacent-stop estimator. */
    public function estimate(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $route = $this->route([
            ['lat' => $fromLat, 'lng' => $fromLng],
            ['lat' => $toLat, 'lng' => $toLng],
        ]);

        return [
            'distance_m' => $route['distance_m'],
            'duration_s' => $route['duration_s'],
            'source' => $route['approximate'] ? 'haversine' : $route['provider'],
        ];
    }

    private function makeProvider(string $provider): RoutingProvider
    {
        if ($provider === 'openrouteservice') {
            return new OpenRouteServiceProvider((string) config('lakbai.routing.ors_api_key', ''), $this->timeout);
        }

        return new OsrmRouteProvider($this->osrmUrl, $this->timeout);
    }

    private function fallback(array $waypoints, string $reason, string $profile): array
    {
        $coordinates = [];
        $legs = [];
        $distance = 0;
        $fallbackSpeed = match ($profile) {
            'walking' => 5.0,
            'cycling' => 15.0,
            default => (float) config('lakbai.routing.fallback_speed_kmh', $this->fallbackSpeedKmh),
        };
        $speedMs = max(1.0, $fallbackSpeed) / 3.6;
        for ($index = 0; $index < count($waypoints); $index++) {
            $point = $waypoints[$index];
            $coordinates[] = [(float) $point['lng'], (float) $point['lat']];
            if ($index === 0) continue;
            $legDistance = (int) round($this->haversine($waypoints[$index - 1], $point));
            $distance += $legDistance;
            $legs[] = ['distance_m' => $legDistance, 'duration_s' => (int) round($legDistance / $speedMs)];
        }
        return [
            'geometry' => ['type' => 'LineString', 'coordinates' => $coordinates],
            'distance_m' => $distance,
            'duration_s' => array_sum(array_column($legs, 'duration_s')),
            'legs' => $legs,
            'instructions' => [],
            'provider' => 'haversine',
            'approximate' => true,
            'reason' => $reason,
        ];
    }

    private function straightDistance(array $waypoints): float
    {
        $distance = 0;
        for ($i = 1; $i < count($waypoints); $i++) $distance += $this->haversine($waypoints[$i - 1], $waypoints[$i]);
        return $distance;
    }

    private function haversine(array $a, array $b): float
    {
        $lat1 = deg2rad((float) $a['lat']); $lat2 = deg2rad((float) $b['lat']);
        $dLat = $lat2 - $lat1; $dLng = deg2rad((float) $b['lng'] - (float) $a['lng']);
        $h = sin($dLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dLng / 2) ** 2;
        return self::EARTH_RADIUS_M * 2 * asin(min(1.0, sqrt($h)));
    }

    /** @param array<int, array{float, float}> $points */
    private function simplify(array $points, float $toleranceM): array
    {
        if (count($points) < 3) return $points;
        $keep = [0 => true, count($points) - 1 => true];
        $stack = [[0, count($points) - 1]];
        while ($stack !== []) {
            [$start, $end] = array_pop($stack);
            $max = 0.0; $maxIndex = null;
            for ($i = $start + 1; $i < $end; $i++) {
                $distance = $this->pointSegmentMeters($points[$i], $points[$start], $points[$end]);
                if ($distance > $max) { $max = $distance; $maxIndex = $i; }
            }
            if ($maxIndex !== null && $max > $toleranceM) {
                $keep[$maxIndex] = true;
                $stack[] = [$start, $maxIndex]; $stack[] = [$maxIndex, $end];
            }
        }
        $indices = array_keys($keep); sort($indices);
        return array_map(fn ($index) => $points[$index], $indices);
    }

    private function pointSegmentMeters(array $p, array $a, array $b): float
    {
        $lat0 = deg2rad((float) $p[1]); $scaleX = cos($lat0) * self::EARTH_RADIUS_M; $scaleY = self::EARTH_RADIUS_M;
        $xy = fn ($point) => [deg2rad((float) $point[0]) * $scaleX, deg2rad((float) $point[1]) * $scaleY];
        [$px, $py] = $xy($p); [$ax, $ay] = $xy($a); [$bx, $by] = $xy($b);
        $dx = $bx - $ax; $dy = $by - $ay; $denom = $dx * $dx + $dy * $dy;
        $t = $denom === 0.0 ? 0.0 : max(0.0, min(1.0, (($px - $ax) * $dx + ($py - $ay) * $dy) / $denom));
        return hypot($px - ($ax + $t * $dx), $py - ($ay + $t * $dy));
    }
}
