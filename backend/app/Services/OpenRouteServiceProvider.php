<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenRouteServiceProvider implements RoutingProvider
{
    public function __construct(private readonly string $apiKey, private readonly int $timeout) {}

    public function route(array $waypoints, string $profile): ?array
    {
        if ($this->apiKey === '') throw new RuntimeException('provider_unavailable');
        $profiles = [
            'driving' => 'driving-car', 'motorcycle' => 'driving-motorcycle',
            'walking' => 'foot-walking', 'cycling' => 'cycling-regular',
        ];
        $routeProfile = $profiles[$profile] ?? 'driving-car';
        $response = Http::timeout(max(1, $this->timeout))->retry(2, 150)->acceptJson()
            ->withHeaders(['Authorization' => $this->apiKey])
            ->post('https://api.openrouteservice.org/v2/directions/'.$routeProfile.'/geojson', [
                'coordinates' => array_map(fn ($point) => [(float) $point['lng'], (float) $point['lat']], $waypoints),
                'instructions' => true,
                'geometry_simplify' => false,
            ]);
        if ($response->status() === 429) throw new RuntimeException('rate_limited');
        if ($response->status() === 404 || $response->status() === 400) return null;
        if (! $response->successful()) throw new RuntimeException('provider_unavailable');

        $feature = $response->json('features.0');
        $coordinates = $feature['geometry']['coordinates'] ?? null;
        if (! is_array($coordinates) || count($coordinates) < 2) return null;
        $summary = $feature['properties']['summary'] ?? [];
        $segments = $feature['properties']['segments'] ?? [];
        return [
            'geometry' => ['type' => 'LineString', 'coordinates' => $coordinates],
            'distance_m' => (int) round((float) ($summary['distance'] ?? 0)),
            'duration_s' => (int) round((float) ($summary['duration'] ?? 0)),
            'legs' => array_map(fn ($leg) => [
                'distance_m' => (int) round((float) ($leg['distance'] ?? 0)),
                'duration_s' => (int) round((float) ($leg['duration'] ?? 0)),
            ], $segments),
            'instructions' => collect($segments)->flatMap(fn ($segment) => collect($segment['steps'] ?? [])->map(function ($step) use ($coordinates) {
                $startIdx = $step['way_points'][0] ?? null;
                $location = ($startIdx !== null && isset($coordinates[$startIdx]) && is_array($coordinates[$startIdx]))
                    ? [(float) $coordinates[$startIdx][0], (float) $coordinates[$startIdx][1]]
                    : null;
                $street = trim((string) ($step['name'] ?? ''));

                return [
                    'instruction' => (string) ($step['instruction'] ?? 'Continue'),
                    'distance_m' => (int) round((float) ($step['distance'] ?? 0)),
                    'duration_s' => (int) round((float) ($step['duration'] ?? 0)),
                    'location' => $location,
                    'type' => isset($step['type']) ? (string) $step['type'] : 'continue',
                    'modifier' => null,
                    'street' => $street !== '' ? $street : null,
                ];
            }))->values()->all(),
        ];
    }
}
