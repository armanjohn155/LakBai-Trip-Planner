<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class OsrmRouteProvider implements RoutingProvider
{
    public function __construct(private readonly string $baseUrl, private readonly int $timeout) {}

    public function route(array $waypoints, string $profile): ?array
    {
        $coordinates = implode(';', array_map(fn ($point) => $point['lng'].','.$point['lat'], $waypoints));
        $response = Http::timeout(max(1, $this->timeout))->retry(2, 150)->acceptJson()->get(
            rtrim($this->baseUrl, '/').'/route/v1/'.$profile.'/'.$coordinates,
            ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'false'],
        );
        if ($response->status() === 429) throw new RuntimeException('rate_limited');
        if (! $response->successful()) throw new RuntimeException('provider_unavailable');
        if ($response->json('code') === 'NoRoute') return null;
        if ($response->json('code') !== 'Ok') throw new RuntimeException('provider_unavailable');

        $route = $response->json('routes.0');
        $coordinates = $route['geometry']['coordinates'] ?? null;
        if (! is_array($coordinates) || count($coordinates) < 2) return null;

        return [
            'geometry' => ['type' => 'LineString', 'coordinates' => $coordinates],
            'distance_m' => (int) round((float) $route['distance']),
            'duration_s' => (int) round((float) $route['duration']),
            'legs' => array_map(fn ($leg) => [
                'distance_m' => (int) round((float) ($leg['distance'] ?? 0)),
                'duration_s' => (int) round((float) ($leg['duration'] ?? 0)),
            ], $route['legs'] ?? []),
        ];
    }
}
