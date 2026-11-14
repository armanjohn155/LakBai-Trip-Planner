<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TrackingPointsRequest;
use App\Http\Resources\ItineraryResource;
use App\Models\Itinerary;
use App\Services\ItineraryConflictGuard;
use App\Services\TripLifecycleService;
use App\Services\TripTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TripTrackingController extends Controller
{
    public function __construct(
        private readonly TripLifecycleService $lifecycle,
        private readonly TripTrackingService $tracking,
        private readonly ItineraryConflictGuard $conflictGuard,
    ) {}

    /**
     * Current session stats, last position and the next unvisited stop.
     */
    public function show(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        return response()->json([
            'data' => $this->tracking->summary($itinerary, $request->user()),
        ]);
    }

    /**
     * Start, pause, resume or stop (finish) the trip and its tracking session.
     */
    public function transition(Request $request, Itinerary $itinerary, string $action): JsonResponse
    {
        Gate::authorize('update', $itinerary);
        $this->conflictGuard->assertFresh($itinerary, $request->input('base_version'));

        $actor = $request->user();

        $itinerary = match ($action) {
            'start' => $this->lifecycle->start($itinerary, $actor),
            'pause' => $this->lifecycle->pause($itinerary, $actor),
            'resume' => $this->lifecycle->resume($itinerary, $actor),
            'stop' => $this->lifecycle->finish($itinerary, $actor)['itinerary'],
        };

        return $this->tripResponse($request, $itinerary);
    }

    /**
     * Ingest a batch of GPS positions for the authenticated traveller.
     */
    public function points(TrackingPointsRequest $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $result = $this->tracking->ingest(
            $itinerary,
            $request->user(),
            $request->validated('points'),
        );

        if (! $result['ok']) {
            return response()->json([
                'message' => $result['message'],
                'accepted' => 0,
                'rejected' => $result['rejected'],
                'distance_m' => $result['distance_m'],
            ], $result['status'] ?? 409);
        }

        return response()->json(['data' => $result]);
    }

    /**
     * Shift remaining stops by N minutes or move them to another day.
     */
    public function reschedule(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('update', $itinerary);
        $this->conflictGuard->assertFresh($itinerary, $request->input('base_version'));

        $validated = $request->validate([
            'strategy' => ['required', 'in:shift,move_day'],
            'minutes' => ['required_if:strategy,shift', 'integer', 'between:-1440,1440'],
            'day_number' => ['required_if:strategy,move_day', 'integer', 'min:1', 'max:30'],
            'base_version' => ['sometimes', 'integer', 'min:1'],
        ]);

        $itinerary = $this->lifecycle->reschedule(
            $itinerary,
            $request->user(),
            $validated['strategy'],
            $validated['strategy'] === 'shift'
                ? ['minutes' => (int) $validated['minutes']]
                : ['day_number' => (int) $validated['day_number']],
        );

        return $this->tripResponse($request, $itinerary);
    }

    /**
     * Cancel an ongoing trip.
     */
    public function cancel(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('update', $itinerary);
        $this->conflictGuard->assertFresh($itinerary, $request->input('base_version'));

        $itinerary = $this->lifecycle->cancel($itinerary, $request->user());

        return $this->tripResponse($request, $itinerary);
    }

    private function tripResponse(Request $request, Itinerary $itinerary): JsonResponse
    {
        $fresh = $itinerary->fresh()->loadForDisplay($request->user());

        return response()->json([
            'data' => (new ItineraryResource($fresh))->resolve(),
            'tracking' => $this->tracking->summary($fresh, $request->user()),
        ]);
    }
}
