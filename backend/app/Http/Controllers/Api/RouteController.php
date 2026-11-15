<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RouteEstimator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RouteController extends Controller
{
    public function __construct(private readonly RouteEstimator $routes) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'waypoints' => ['required', 'array', 'min:2', 'max:25'],
            'waypoints.*' => ['required', 'array:lat,lng'],
            'waypoints.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'waypoints.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'profile' => ['sometimes', 'in:driving,motorcycle,walking,cycling'],
        ]);

        return response()->json([
            'data' => $this->routes->route(
                $validated['waypoints'],
                $validated['profile'] ?? 'driving',
            ),
        ]);
    }
}
