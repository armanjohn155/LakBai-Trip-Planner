<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ItineraryMemberResource;
use App\Models\Itinerary;
use App\Models\User;
use App\Services\TripInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;

class ItineraryMemberController extends Controller
{
    public function __construct(private readonly TripInvitationService $invitations) {}

    /**
     * List members of a trip. Owners also see pending invitations; accepted
     * members see only accepted collaborators. Emails are never exposed.
     */
    public function index(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $isOwner = $itinerary->roleFor(request()->user()) === Itinerary::ROLE_OWNER;

        $itinerary->loadMissing('user');

        $members = $itinerary->members()
            ->when(! $isOwner, fn ($query) => $query->wherePivot('status', Itinerary::STATUS_ACCEPTED))
            ->when($isOwner, fn ($query) => $query->wherePivotIn('status', [
                Itinerary::STATUS_ACCEPTED,
                Itinerary::STATUS_PENDING,
            ]))
            ->orderByRaw("CASE WHEN itinerary_user.status = 'accepted' THEN 0 ELSE 1 END")
            ->orderBy('users.name')
            ->get();

        $owner = $itinerary->user;

        $rows = [];

        if ($owner !== null) {
            $rows[] = [
                'id' => $owner->id,
                'name' => $owner->name,
                'username' => $owner->username,
                'avatar_url' => $owner->avatar_url,
                'role' => Itinerary::ROLE_OWNER,
                'status' => Itinerary::STATUS_ACCEPTED,
                'rsvp' => null,
                'invited_at' => null,
                'responded_at' => null,
                'joined_at' => $itinerary->created_at,
            ];
        }

        foreach (ItineraryMemberResource::collection($members)->resolve(request()) as $member) {
            $rows[] = $member;
        }

        return response()->json(['data' => $rows]);
    }

    /**
     * Invite accepted friends. Owner only.
     */
    public function store(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('manageMembers', $itinerary);

        $validated = request()->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'role' => ['required', 'in:editor,viewer'],
        ]);

        $this->invitations->invite(
            $itinerary,
            request()->user(),
            $validated['user_ids'],
            $validated['role'],
        );

        return $this->membersResponse($itinerary->fresh(), 201);
    }

    /**
     * Change a member's role. Owner only.
     */
    public function update(Itinerary $itinerary, User $user): JsonResponse
    {
        Gate::authorize('manageMembers', $itinerary);

        $validated = request()->validate([
            'role' => ['required', 'in:editor,viewer'],
        ]);

        $this->invitations->changeRole($itinerary, request()->user(), $user, $validated['role']);

        return $this->membersResponse($itinerary->fresh());
    }

    /**
     * Remove a member (owner), leave (self), or cancel a pending invite.
     */
    public function destroy(Itinerary $itinerary, User $user): Response
    {
        $actor = request()->user();
        $isSelf = (int) $actor->id === (int) $user->id;

        if ($isSelf) {
            Gate::authorize('view', $itinerary);
        } else {
            Gate::authorize('manageMembers', $itinerary);
        }

        $this->invitations->removeMember($itinerary, $actor, $user);

        return response()->noContent();
    }

    /**
     * Preview of a pending invitation (title, owner, role) for the invitee.
     */
    public function invitation(int $itinerary): JsonResponse
    {
        $model = Itinerary::query()->findOrFail($itinerary);
        $user = request()->user();

        $status = $model->statusFor($user);

        if ($status === null || $status === Itinerary::STATUS_ACCEPTED) {
            abort(404);
        }

        $model->loadMissing('user');
        $member = $model->members()->whereKey($user->id)->first();

        return response()->json([
            'data' => [
                'itinerary_id' => $model->id,
                'title' => $model->title,
                'owner' => [
                    'id' => $model->user_id,
                    'name' => $model->user?->name,
                    'username' => $model->user?->username,
                    'avatar_url' => $model->user?->avatar_url,
                ],
                'role' => $member?->pivot?->role,
                'status' => $status,
                'invited_at' => $member?->pivot?->invited_at,
            ],
        ]);
    }

    /**
     * Accept a pending invitation.
     */
    public function accept(int $itinerary): JsonResponse
    {
        $model = Itinerary::query()->findOrFail($itinerary);

        $this->invitations->accept($model, request()->user());

        return response()->json([
            'data' => ['itinerary_id' => $model->id],
            'message' => 'You joined the trip.',
        ]);
    }

    /**
     * Decline a pending invitation.
     */
    public function decline(int $itinerary): JsonResponse
    {
        $model = Itinerary::query()->findOrFail($itinerary);

        $this->invitations->decline($model, request()->user());

        return response()->json([
            'data' => ['itinerary_id' => $model->id],
            'message' => 'Invitation declined.',
        ]);
    }

    /**
     * Update the current member's RSVP.
     */
    public function rsvp(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $validated = request()->validate([
            'rsvp' => ['required', 'in:going,maybe,declined'],
        ]);

        $this->invitations->rsvp($itinerary, request()->user(), $validated['rsvp']);

        return $this->membersResponse($itinerary->fresh());
    }

    private function membersResponse(Itinerary $itinerary, int $status = 200): JsonResponse
    {
        $response = $this->index($itinerary);

        return $response->setStatusCode($status);
    }
}
