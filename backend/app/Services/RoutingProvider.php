<?php

namespace App\Services;

interface RoutingProvider
{
    /** @param array<int, array{lat: float, lng: float}> $waypoints */
    public function route(array $waypoints, string $profile): ?array;
}
