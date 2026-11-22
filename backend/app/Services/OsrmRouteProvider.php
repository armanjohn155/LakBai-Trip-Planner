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
            ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'true'],
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
            'instructions' => collect($route['legs'] ?? [])->flatMap(fn ($leg) => collect($leg['steps'] ?? [])->map(function ($step) {
                $maneuver = $step['maneuver'] ?? [];
                $location = isset($maneuver['location']) && is_array($maneuver['location']) && count($maneuver['location']) >= 2
                    ? [(float) $maneuver['location'][0], (float) $maneuver['location'][1]]
                    : null;
                $type = (string) ($maneuver['type'] ?? 'continue');
                $modifier = (string) ($maneuver['modifier'] ?? '');
                $street = trim((string) ($step['name'] ?? ''));

                return [
                    'instruction' => $this->instruction($step),
                    'distance_m' => (int) round((float) ($step['distance'] ?? 0)),
                    'duration_s' => (int) round((float) ($step['duration'] ?? 0)),
                    'location' => $location,
                    'type' => $type,
                    'modifier' => $modifier !== '' ? $modifier : null,
                    'street' => $street !== '' ? $street : null,
                ];
            }))->filter(fn ($step) => $step['instruction'] !== 'Continue')->values()->all(),
        ];
    }

    private function instruction(array $step): string
    {
        $maneuver = $step['maneuver'] ?? [];
        $type = (string) ($maneuver['type'] ?? 'continue');
        $modifier = (string) ($maneuver['modifier'] ?? '');
        $street = trim((string) ($step['name'] ?? ''));
        $action = match ($type) {
            'depart' => 'Start',
            'arrive' => 'Arrive',
            'turn', 'end of road' => 'Turn'.($modifier !== '' ? " {$modifier}" : ''),
            'fork' => 'Keep'.($modifier !== '' ? " {$modifier}" : ''),
            'merge' => 'Merge'.($modifier !== '' ? " {$modifier}" : ''),
            'on ramp' => 'Take the ramp',
            'off ramp' => 'Take the exit',
            'roundabout', 'rotary' => 'Enter the roundabout',
            default => 'Continue',
        };

        return $street !== '' ? "{$action} onto {$street}" : $action;
    }
}
