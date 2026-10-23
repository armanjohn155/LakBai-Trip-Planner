<?php

namespace App\Http\Controllers\Api;

use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Services\ItineraryActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ItineraryInviteAcceptController extends Controller
{
    public function __construct(private readonly ItineraryActivityLogger $activityLogger) {}

    /**
     * Preview an invite before accepting (no stops/private details).
     */
    public function show(string $token): JsonResponse
    {
        Gate::authorize('viewAny', \App\Models\Itinerary::class);
        $invite = $this->findValidInvite($token);

        if ($invite === null) {
            return response()->json([
                'message' => 'This invite link is invalid, expired, revoked or has already been used.',
            ], 410);
        }

        if (! $invite->isRedeemable()) {
            return response()->json([
                'message' => 'This invite link is invalid, expired, revoked or has already been used.',
            ], 410);
        }

        $invite->loadMissing('itinerary.user');

        return response()->json([
            'data' => [
                'itinerary_name' => $invite->itinerary->title,
                'owner_name' => $invite->itinerary->user?->name,
                'role' => $invite->role,
                'expires_at' => $invite->expires_at,
                'member_count' => $invite->itinerary->members()->count() + 1, // +owner
            ],
        ]);
    }

    /**
     * Accept an invite. Enforces email match for email invites.
     */
    public function accept(string $token): JsonResponse
    {
        Gate::authorize('viewAny', \App\Models\Itinerary::class);
        $this->enforceThrottle();

        $user = request()->user();
        $invite = $this->findValidInvite($token);

        if ($invite === null) {
            return response()->json([
                'message' => 'This invite link is invalid, expired, revoked or has already been used.',
            ], 410);
        }

        $invite->loadMissing('itinerary');

        if ($invite->itinerary->user_id === $user->id) {
            abort(403, 'The owner cannot accept their own invite.');
        }

        if ($invite->type === 'email' && $invite->email !== null) {
            if (strtolower($invite->email) !== strtolower($user->email)) {
                abort(403, 'This invite was sent to a different email address.');
            }
        }

        // Already a member: idempotent.
        if ($invite->itinerary->members()->whereKey($user->id)->exists()) {
            return response()->json([
                'data' => ['itinerary_id' => $invite->itinerary_id],
                'message' => 'You are already a member of this itinerary.',
            ], 200);
        }

        $itineraryId = $invite->itinerary_id;

        $itinerary = DB::transaction(function () use ($invite, $user) {
            // Lock the invite row to prevent race conditions on max_uses.
            $locked = ItineraryInvite::query()->whereKey($invite->id)->lockForUpdate()->first();

            if ($locked === null || ! $locked->isRedeemable()) {
                abort(410, 'This invite is no longer redeemable.');
            }

            $itinerary = $locked->itinerary()->lockForUpdate()->firstOrFail();

            // Double-check membership inside transaction.
            if ($itinerary->members()->whereKey($user->id)->exists()) {
                return $itinerary;
            }

            // Cap enforcement.
            if ($itinerary->members()->count() >= (int) config('lakbai.sharing.max_members', 20)) {
                abort(422, 'This itinerary has reached the member limit.');
            }

            $itinerary->members()->attach($user->id, [
                'role' => $locked->role,
                'status' => Itinerary::STATUS_ACCEPTED,
                'invited_by' => $locked->created_by,
                'invited_at' => now(),
                'responded_at' => now(),
                'joined_at' => now(),
            ]);

            $locked->increment('uses_count');

            app(\App\Services\TripInvitationService::class)->syncTripType($itinerary);

            $this->activityLogger->log($itinerary, 'member.joined', $user, $user);

            event(new \App\Events\TripMemberJoinedViaLink($itinerary, $user, $locked->role));

            return $itinerary;
        });

        return response()->json([
            'data' => ['itinerary_id' => $itinerary->id],
            'message' => 'You have joined the itinerary.',
        ], 200);
    }

    private function findValidInvite(string $token): ?ItineraryInvite
    {
        return ItineraryInvite::query()
            ->where('token', hash('sha256', $token))
            ->with('itinerary')
            ->first();
    }

    private function enforceThrottle(): void
    {
        $key = 'itinerary-invite-accept:'.request()->user()->id;
        $throttle = config('lakbai.sharing.invite_accept_throttle', '10,1');
        [$max, $decay] = array_map('intval', explode(',', $throttle));
        \Illuminate\Support\Facades\RateLimiter::hit($key, $decay * 60);
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($key, $max)) {
            abort(429, 'Too many attempts. Please try again later.');
        }
    }
}
