<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Estimates road distance/duration between consecutive itinerary stops.
 *
 * Primary source is an OSRM server (config: lakbai.routing.osrm_url). The
 * default public demo server is for LIGHT DEVELOPMENT USE ONLY — self-host
 * OSRM or switch to OpenRouteService for production.
 *
 * Every call is best-effort: a short timeout plus a Haversine straight-line
 * fallback means the itinerary page is never blocked by a routing failure.
 */
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

    /**
     * Build an estimator from config/lakbai.php.
     */
    public static function fromConfig(): self
    {
        return new self(
            enabled: (bool) config('lakbai.routing.enabled', false),
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
     * Estimate the leg between two coordinates.
     *
     * @return array{distance_m: int, duration_s: int, source: string}
     */
    public function estimate(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $key = sprintf('route:%s,%s->%s,%s', $fromLat, $fromLng, $toLat, $toLng);

        return Cache::remember($key, $this->cacheTtl, function () use ($fromLat, $fromLng, $toLat, $toLng) {
            if ($this->enabled) {
                $route = $this->queryOsrm($fromLat, $fromLng, $toLat, $toLng);

                if ($route !== null) {
                    return $route;
                }
            }

            return $this->haversineFallback($fromLat, $fromLng, $toLat, $toLng);
        });
    }

    /**
     * Query OSRM for a driving route. Returns null on any failure.
     *
     * @return array{distance_m: int, duration_s: int, source: string}|null
     */
    private function queryOsrm(float $fromLat, float $fromLng, float $toLat, float $toLng): ?array
    {
        try {
            $url = rtrim($this->osrmUrl, '/')
                ."/route/v1/driving/{$fromLng},{$fromLat};{$toLng},{$toLat}";

            $response = Http::timeout($this->timeout)
                ->acceptJson()
                ->get($url, ['overview' => 'false']);

            if (! $response->successful()) {
                return null;
            }

            $route = $response->json('routes.0');

            if (! is_array($route) || ! isset($route['distance'], $route['duration'])) {
                return null;
            }

            return [
                'distance_m' => (int) round((float) $route['distance']),
                'duration_s' => (int) round((float) $route['duration']),
                'source' => 'osrm',
            ];
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Straight-line estimate using the configured average speed.
     *
     * @return array{distance_m: int, duration_s: int, source: string}
     */
    private function haversineFallback(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $distanceM = $this->haversineMeters($fromLat, $fromLng, $toLat, $toLng);

        // Straight-line inflated 1.3x to approximate road windiness.
        $roadM = $distanceM * 1.3;
        $speedMs = max($this->fallbackSpeedKmh, 1.0) / 3.6;

        return [
            'distance_m' => (int) round($roadM),
            'duration_s' => (int) round($roadM / $speedMs),
            'source' => 'haversine',
        ];
    }

    private function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $lat1Rad = deg2rad($lat1);
        $lat2Rad = deg2rad($lat2);
        $deltaLat = deg2rad($lat2 - $lat1);
        $deltaLng = deg2rad($lng2 - $lng1);

        $a = sin($deltaLat / 2) ** 2
            + cos($lat1Rad) * cos($lat2Rad) * sin($deltaLng / 2) ** 2;

        return self::EARTH_RADIUS_M * 2 * asin(min(1.0, sqrt($a)));
    }
}
