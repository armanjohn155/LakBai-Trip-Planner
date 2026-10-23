<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ItineraryInviteResource;
use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Services\TripInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;

class InviteLinkController extends Controller
{
    public function __construct(private readonly TripInvitationService $invitations) {}

    /**
     * List active share links for a trip. Owner only.
     */
    public function index(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('manageMembers', $itinerary);

        $links = $itinerary->invites()
            ->where('type', 'link')
            ->latest()
            ->get();

        return response()->json([
            'data' => ItineraryInviteResource::collection($links)->resolve(request()),
        ]);
    }

    /**
     * Create a share link. The raw token is returned exactly once.
     */
    public function store(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('manageMembers', $itinerary);
        $this->enforceThrottle('itinerary-link:'.request()->user()->id, 'invite_throttle', '20,1');

        $validated = request()->validate([
            'role' => ['required', 'in:editor,viewer'],
            'expires_in_days' => ['nullable', 'integer', 'min:0', 'max:'.config('lakbai.sharing.max_expiry_days', 30)],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        ['invite' => $invite, 'token' => $token] = $this->invitations->createLink(
            $itinerary,
            request()->user(),
            $validated['role'],
            isset($validated['expires_in_days']) ? (int) $validated['expires_in_days'] : null,
            isset($validated['max_uses']) ? (int) $validated['max_uses'] : null,
        );

        $url = rtrim((string) config('lakbai.sharing.frontend_url'), '/').'/invite/'.$token;

        return response()->json([
            'data' => (new ItineraryInviteResource($invite))->resolve(request()),
            'token' => $token,
            'invite_url' => $url,
        ], 201);
    }

    /**
     * Revoke a share link. Owner only.
     */
    public function destroy(Itinerary $itinerary, ItineraryInvite $invite): Response
    {
        Gate::authorize('manageMembers', $itinerary);

        if ((int) $invite->itinerary_id !== (int) $itinerary->id || $invite->type !== 'link') {
            abort(404);
        }

        if (! $invite->isRevoked()) {
            $invite->update(['revoked_at' => now()]);
        }

        return response()->noContent();
    }

    /**
     * Preview a share link without joining. Never returns private trip data.
     */
    public function show(string $token): JsonResponse
    {
        $invite = $this->invitations->previewLink($token);

        if ($invite === null) {
            return response()->json([
                'message' => 'This invite link is invalid, expired, revoked or has already been used.',
            ], 410);
        }

        return response()->json([
            'data' => [
                'itinerary_id' => $invite->itinerary_id,
                'itinerary_name' => $invite->itinerary->title,
                'owner' => [
                    'name' => $invite->itinerary->user?->name,
                    'username' => $invite->itinerary->user?->username,
                    'avatar_url' => $invite->itinerary->user?->avatar_url,
                ],
                'role' => $invite->role,
                'expires_at' => $invite->expires_at,
                'member_count' => $invite->itinerary->acceptedMembers()->count() + 1,
            ],
        ]);
    }

    /**
     * Accept a share link. Uses a row lock so a one-use link cannot be
     * redeemed twice concurrently.
     */
    public function accept(string $token): JsonResponse
    {
        $this->enforceThrottle('itinerary-link-accept:'.request()->user()->id, 'invite_accept_throttle', '10,1');

        $itinerary = $this->invitations->acceptLink($token, request()->user());

        return response()->json([
            'data' => ['itinerary_id' => $itinerary->id],
            'message' => 'You joined the trip.',
        ]);
    }

    private function enforceThrottle(string $key, string $configKey, string $default): void
    {
        $throttle = (string) config('lakbai.sharing.'.$configKey, $default);
        [$max, $decay] = array_map('intval', explode(',', $throttle));

        RateLimiter::hit($key, $decay * 60);

        if (RateLimiter::tooManyAttempts($key, $max)) {
            abort(429, 'Too many attempts. Please try again later.');
        }
    }
}
