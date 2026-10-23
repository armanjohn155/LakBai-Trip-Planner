<?php

namespace App\Http\Controllers\Api;

use App\Models\Itinerary;
use App\Services\TripInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;

class ItineraryOwnershipController extends Controller
{
    public function __construct(private readonly TripInvitationService $invitations) {}

    /**
     * Transfer ownership to an accepted member. The old owner becomes an
     * editor in the same transaction.
     */
    public function transfer(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('transferOwnership', $itinerary);

        $validated = request()->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $this->invitations->transferOwnership($itinerary, request()->user(), (int) $validated['user_id']);

        return response()->json([
            'data' => ['itinerary_id' => $itinerary->id],
            'message' => 'Ownership transferred.',
        ]);
    }
}
