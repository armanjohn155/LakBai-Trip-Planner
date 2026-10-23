<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ItineraryInviteResource;
use App\Mail\ItineraryInviteMail;
use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Models\User;
use App\Notifications\ItineraryInviteNotification;
use App\Services\FriendshipService;
use App\Services\TripInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ItineraryInviteController extends Controller
{
    public function __construct(
        private readonly TripInvitationService $invitations,
        private readonly FriendshipService $friends,
    ) {}

    /**
     * List pending/active invites for the itinerary. Owner only.
     */
    public function index(Itinerary $itinerary): AnonymousResourceCollection
    {
        Gate::authorize('manageMembers', $itinerary);

        $invites = $itinerary->invites()->latest()->get();

        return ItineraryInviteResource::collection($invites);
    }

    /**
     * Create an email or link invite. Owner only.
     */
    public function store(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('manageMembers', $itinerary);

        $validated = request()->validate([
            'type' => ['required', 'in:email,link'],
            'email' => ['required_if:type,email', 'nullable', 'email', 'max:255'],
            'role' => ['required', 'in:editor,viewer'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:'.config('lakbai.sharing.max_expiry_days', 30)],
            'max_uses' => ['nullable', 'integer', 'min:1'],
        ]);

        $user = request()->user();
        $maxMembers = (int) config('lakbai.sharing.max_members', 20);
        $maxInvites = (int) config('lakbai.sharing.max_invites', 20);

        $currentMembers = $this->invitations->memberAndPendingCount($itinerary);
        if ($currentMembers >= $maxMembers) {
            throw ValidationException::withMessages([
                'members' => "This itinerary has reached the member limit ({$maxMembers}).",
            ]);
        }

        $activeInvites = $itinerary->invites()
            ->whereNull('revoked_at')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->where(function ($query) {
                $query->whereNull('max_uses')->orWhereRaw('uses_count < max_uses');
            })
            ->count();

        if ($activeInvites >= $maxInvites) {
            throw ValidationException::withMessages([
                'invites' => "This itinerary has reached the active invite limit ({$maxInvites}).",
            ]);
        }

        if (($validated['type'] ?? null) === 'email') {
            $email = strtolower($validated['email']);

            $invitee = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
            $owner = $itinerary->user;

            if ($owner === null || $email === strtolower((string) $owner->email)) {
                throw ValidationException::withMessages([
                    'email' => 'You cannot invite the itinerary owner.',
                ]);
            }

            if ($invitee === null) {
                throw ValidationException::withMessages([
                    'email' => 'No Lakbai account uses that email address. Share an invite link instead.',
                ]);
            }

            if ($this->friends->isBlockedBetween($owner, $invitee)) {
                throw ValidationException::withMessages([
                    'email' => 'You cannot invite a user you have blocked or who has blocked you.',
                ]);
            }

            if (! $this->friends->areFriends($owner, $invitee)) {
                throw ValidationException::withMessages([
                    'email' => 'You can only invite accepted friends.',
                ]);
            }

            if ($itinerary->members()->whereKey($invitee->id)->exists()) {
                throw ValidationException::withMessages([
                    'email' => 'This email is already a member of the itinerary.',
                ]);
            }

            if ($itinerary->invites()->whereNull('revoked_at')->where('type', 'email')->whereRaw('LOWER(email) = ?', [$email])->exists()) {
                throw ValidationException::withMessages([
                    'email' => 'A pending invite already exists for this email.',
                ]);
            }

            $rawToken = Str::random(64);
            $expiryDays = $validated['expires_in_days'] ?? config('lakbai.sharing.default_expiry_days', 7);

            $invite = $itinerary->invites()->create([
                'email' => $email,
                'token' => hash('sha256', $rawToken),
                'role' => $validated['role'],
                'type' => 'email',
                'max_uses' => 1,
                'uses_count' => 0,
                'expires_at' => now()->addDays((int) $expiryDays),
                'created_by' => $user->id,
            ]);

            $frontendUrl = rtrim((string) config('lakbai.sharing.frontend_url'), '/');
            $url = $frontendUrl.'/invite/'.$rawToken;

            // Best-effort notification; queued if the mailer/queue is configured.
            if (class_exists(ItineraryInviteNotification::class)) {
                Notification::route('mail', $email)->notify(new ItineraryInviteNotification($invite, $itinerary, $url));
            } elseif (class_exists(ItineraryInviteMail::class)) {
                Mail::to($email)->queue(new ItineraryInviteMail($invite, $itinerary, $url));
            }

            return response()->json([
                'data' => (new ItineraryInviteResource($invite))->resolve(),
                'invite_url' => $url,
                'token' => $rawToken,
                'message' => 'Invite created. The link is shown only once.',
            ], 201);
        }

        // Link invite
        $rawToken = Str::random(64);
        $expiryDays = $validated['expires_in_days'] ?? config('lakbai.sharing.default_expiry_days', 7);
        $maxUses = $validated['max_uses'] ?? null;

        $invite = $itinerary->invites()->create([
            'email' => null,
            'token' => hash('sha256', $rawToken),
            'role' => $validated['role'],
            'type' => 'link',
            'max_uses' => $maxUses,
            'uses_count' => 0,
            'expires_at' => $expiryDays > 0 ? now()->addDays((int) $expiryDays) : null,
            'created_by' => $user->id,
        ]);

        $frontendUrl = rtrim((string) config('lakbai.sharing.frontend_url'), '/');
        $url = $frontendUrl.'/invite/'.$rawToken;

        return response()->json([
            'data' => (new ItineraryInviteResource($invite))->resolve(),
            'invite_url' => $url,
            'token' => $rawToken,
            'message' => 'Share link created. The link is shown only once.',
        ], 201);
    }

    /**
     * Revoke a pending invite. Owner only.
     */
    public function destroy(Itinerary $itinerary, ItineraryInvite $invite): Response
    {
        Gate::authorize('manageMembers', $itinerary);

        if ($invite->itinerary_id !== $itinerary->id) {
            abort(404);
        }

        if (! $invite->isRevoked()) {
            $invite->update(['revoked_at' => now()]);
        }

        return response()->noContent();
    }
}
