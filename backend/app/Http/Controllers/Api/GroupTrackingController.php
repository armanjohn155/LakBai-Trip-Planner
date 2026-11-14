<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Itinerary;
use App\Services\GroupTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Group live tracking. Reads are available to every accepted member, but
 * positions/presence only appear once the requester is also sharing. Writes
 * only ever affect the authenticated traveller's own sharing state.
 */
class GroupTrackingController extends Controller
{
    public function __construct(private readonly GroupTrackingService $group) {}

    /**
     * Party roster, latest shared positions, presence and the meetup pin.
     */
    public function show(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        abort_unless($this->group->isGroup($itinerary), 404);

        return response()->json([
            'data' => $this->group->state($itinerary, $request->user()),
        ]);
    }

    /**
     * Opt in or out of sharing this traveller's live position with the party.
     */
    public function sharing(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->group->setSharing(
                $itinerary,
                $request->user(),
                (bool) $validated['enabled'],
            ),
        ]);
    }

    /**
     * Replace the trip's temporary "meet here" pin.
     */
    public function meetup(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $validated = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'note' => ['nullable', 'string', 'max:140'],
        ]);

        $meetup = $this->group->pinMeetup(
            $itinerary,
            $request->user(),
            (float) $validated['lat'],
            (float) $validated['lng'],
            $validated['note'] ?? null,
        );

        return response()->json([
            'data' => $this->group->meetupPayload($meetup),
        ], 201);
    }
}
