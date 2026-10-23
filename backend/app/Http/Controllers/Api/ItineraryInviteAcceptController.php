<?php

namespace App\Http\Controllers\Api;

use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Services\TripInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;

class ItineraryInviteAcceptController extends Controller
{
    public function __construct(private readonly TripInvitationService $invitations) {}

    /**
     * Preview an invite before accepting (no stops/private details).
     */
    public function show(string $token): JsonResponse
    {
        Gate::authorize('viewAny', Itinerary::class);

        $invite = $this->findValidInvite($token);

        if ($invite === null) {
            return $this->invalidResponse();
        }

        $invite->loadMissing('itinerary.user');

        return response()->json([
            'data' => [
                'itinerary_id' => $invite->itinerary_id,
                'itinerary_name' => $invite->itinerary->title,
                'owner_name' => $invite->itinerary->user?->name,
                'owner_username' => $invite->itinerary->user?->username,
                'type' => $invite->type,
                'role' => $invite->role,
                'expires_at' => $invite->expires_at,
                'member_count' => $invite->itinerary->acceptedMembers()->count() + 1,
            ],
        ]);
    }

    /**
     * Accept an email or link invite. Email invites must match the signed-in
     * account; all redemptions enforce membership caps, blocks and use limits
     * inside a row-locked transaction.
     */
    public function accept(string $token): JsonResponse
    {
        Gate::authorize('viewAny', Itinerary::class);

        $itinerary = $this->invitations->acceptToken($token, request()->user(), true);

        return response()->json([
            'data' => ['itinerary_id' => $itinerary->id],
            'message' => 'You have joined the itinerary.',
        ]);
    }

    private function findValidInvite(string $token): ?ItineraryInvite
    {
        $invite = ItineraryInvite::query()
            ->where('token', hash('sha256', $token))
            ->with('itinerary')
            ->first();

        return $invite !== null && $invite->isRedeemable() ? $invite : null;
    }

    private function invalidResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'This invite link is invalid, expired, revoked or has already been used.',
        ], 410);
    }
}
