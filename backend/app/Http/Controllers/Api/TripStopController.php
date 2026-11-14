<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItineraryItemResource;
use App\Http\Resources\ItineraryResource;
use App\Http\Resources\VisitResource;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use App\Services\ItineraryConflictGuard;
use App\Services\TripLifecycleService;
use App\Services\TripTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TripStopController extends Controller
{
    public function __construct(
        private readonly TripLifecycleService $lifecycle,
        private readonly TripTrackingService $tracking,
        private readonly ItineraryConflictGuard $conflictGuard,
    ) {}

    public function arrive(Request $request, Itinerary $itinerary, ItineraryItem $item): JsonResponse
    {
        $this->authorizeStop($request, $itinerary, $item);

        $item = $this->lifecycle->arrive($itinerary, $item, $request->user());

        return $this->stopResponse($request, $itinerary, $item);
    }

    /**
     * Complete a stop through the existing verified check-in service.
     */
    public function complete(Request $request, Itinerary $itinerary, ItineraryItem $item): JsonResponse
    {
        $this->authorizeStop($request, $itinerary, $item);

        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0', 'max:100000'],
            'base_version' => ['sometimes', 'integer', 'min:1'],
        ]);

        $result = $this->lifecycle->complete($itinerary, $item, $request->user(), [
            'latitude' => (float) $validated['latitude'],
            'longitude' => (float) $validated['longitude'],
            'accuracy' => (float) $validated['accuracy'],
        ]);

        if (! $result['ok']) {
            return response()->json([
                'message' => $result['message'],
                'reason' => $result['reason'] ?? null,
                'distance_m' => $result['distance_m'] ?? null,
                'radius_m' => $result['radius_m'] ?? null,
                'can_retry' => true,
            ], $result['status'] ?? 422);
        }

        return $this->stopResponse($request, $itinerary, $result['item'], [
            'can_review' => (bool) ($result['can_review'] ?? false),
            'visit' => $result['visit'] !== null
                ? new VisitResource($result['visit'])
                : null,
            'distance_m' => $result['distance_m'] ?? null,
            'radius_m' => $result['radius_m'] ?? null,
        ]);
    }

    public function skip(Request $request, Itinerary $itinerary, ItineraryItem $item): JsonResponse
    {
        $this->authorizeStop($request, $itinerary, $item);

        $item = $this->lifecycle->skip($itinerary, $item, $request->user());

        return $this->stopResponse($request, $itinerary, $item);
    }

    public function undo(Request $request, Itinerary $itinerary, ItineraryItem $item): JsonResponse
    {
        $this->authorizeStop($request, $itinerary, $item);

        $item = $this->lifecycle->undo($itinerary, $item, $request->user());

        return $this->stopResponse($request, $itinerary, $item);
    }

    private function authorizeStop(Request $request, Itinerary $itinerary, ItineraryItem $item): void
    {
        Gate::authorize('update', $itinerary);

        if ((int) $item->itinerary_id !== (int) $itinerary->id) {
            abort(404);
        }

        $this->conflictGuard->assertFresh($itinerary, $request->input('base_version'), 'stop', $item->id);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function stopResponse(Request $request, Itinerary $itinerary, ItineraryItem $item, array $extra = []): JsonResponse
    {
        $fresh = $itinerary->fresh()->loadForDisplay($request->user());

        return response()->json([
            'data' => (new ItineraryResource($fresh))->resolve(),
            'stop' => (new ItineraryItemResource($item->fresh()))->resolve(),
            'tracking' => $this->tracking->summary($fresh, $request->user()),
            ...$extra,
        ]);
    }
}
