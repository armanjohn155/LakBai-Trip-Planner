<?php

namespace App\Services;

use App\Events\TripInviteAccepted;
use App\Events\TripInviteDeclined;
use App\Events\TripInviteSent;
use App\Events\TripMemberJoinedViaLink;
use App\Events\TripMemberLeft;
use App\Events\TripMemberRemoved;
use App\Events\TripMemberRoleChanged;
use App\Events\TripOwnershipTransferred;
use App\Models\Itinerary;
use App\Models\ItineraryInvite;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * All trip invitation and membership rules live here. Controllers only
 * validate input and translate results into HTTP responses.
 */
class TripInvitationService
{
    public function __construct(
        private readonly FriendshipService $friends,
        private readonly ItineraryActivityLogger $activityLogger,
    ) {}

    /**
     * Invite accepted friends to a trip. Creates pending membership rows.
     *
     * @param  array<int, int|string>  $userIds
     * @return Collection<int, User>
     */
    public function invite(Itinerary $itinerary, User $actor, array $userIds, string $role): Collection
    {
        $this->assertOwner($itinerary, $actor);
        $role = $this->normalizeRole($role);

        $ids = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn (int $id) => $id === (int) $actor->id)
            ->values();

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages([
                'user_ids' => 'Select at least one friend to invite.',
            ]);
        }

        $users = User::query()->whereIn('id', $ids)->get()->keyBy('id');

        foreach ($ids as $id) {
            if (! $users->has($id)) {
                throw ValidationException::withMessages([
                    'user_ids' => 'One or more selected users could not be found.',
                ]);
            }
        }

        foreach ($users as $user) {
            if ($this->friends->isBlockedBetween($actor, $user)) {
                throw ValidationException::withMessages([
                    'user_ids' => 'You cannot invite a user you have blocked or who has blocked you.',
                ]);
            }

            if (! $this->friends->areFriends($actor, $user)) {
                throw ValidationException::withMessages([
                    'user_ids' => 'You can only invite accepted friends.',
                ]);
            }
        }

        // Re-inviting an existing accepted or pending member is a no-op rather
        // than a duplicate notification.
        $users = $users
            ->reject(fn (User $user) => $this->isActiveMember($itinerary, $user))
            ->values();

        if ($users->isEmpty()) {
            return $users;
        }

        $maxMembers = (int) config('lakbai.sharing.max_members', 20);
        $current = $this->memberAndPendingCount($itinerary);

        if ($current + $users->count() > $maxMembers) {
            throw ValidationException::withMessages([
                'members' => "This trip has reached the member limit ({$maxMembers}).",
            ]);
        }

        DB::transaction(function () use ($itinerary, $actor, $users, $role) {
            foreach ($users as $user) {
                $itinerary->members()->syncWithoutDetaching([
                    $user->id => [
                        'role' => $role,
                        'status' => Itinerary::STATUS_PENDING,
                        'invited_by' => $actor->id,
                        'invited_at' => now(),
                        'responded_at' => null,
                    ],
                ]);

                event(new TripInviteSent($itinerary, $actor, $user, $role));
            }

            $this->activityLogger->recordChange($itinerary, 'member.invited', $actor, null, [
                'count' => $users->count(),
                'role' => $role,
            ]);
        });

        return $users;
    }

    public function accept(Itinerary $itinerary, User $user): Itinerary
    {
        return DB::transaction(function () use ($itinerary, $user) {
            $member = $itinerary->members()
                ->whereKey($user->id)
                ->lockForUpdate()
                ->first();

            if ($member === null || $member->pivot->status !== Itinerary::STATUS_PENDING) {
                abort(404, 'No pending invitation found for this trip.');
            }

            $itinerary->loadMissing('user');

            if ($itinerary->user !== null && $this->friends->isBlockedBetween($itinerary->user, $user)) {
                abort(403, 'You cannot join a trip shared by a user you have blocked or who has blocked you.');
            }

            $itinerary->members()->updateExistingPivot($user->id, [
                'status' => Itinerary::STATUS_ACCEPTED,
                'responded_at' => now(),
                'joined_at' => now(),
            ]);

            $this->syncTripType($itinerary);
            $this->activityLogger->recordChange($itinerary, 'member.accepted', $user, $user);
            event(new TripInviteAccepted($itinerary, $user, $member->pivot->role));

            return $itinerary->fresh();
        });
    }

    public function decline(Itinerary $itinerary, User $user): Itinerary
    {
        return DB::transaction(function () use ($itinerary, $user) {
            $member = $itinerary->members()->whereKey($user->id)->lockForUpdate()->first();

            if ($member === null || $member->pivot->status !== Itinerary::STATUS_PENDING) {
                abort(404, 'No pending invitation found for this trip.');
            }

            $itinerary->members()->updateExistingPivot($user->id, [
                'status' => Itinerary::STATUS_DECLINED,
                'responded_at' => now(),
            ]);

            $this->activityLogger->recordChange($itinerary, 'member.declined', $user, $user);
            event(new TripInviteDeclined($itinerary, $user));

            return $itinerary->fresh();
        });
    }

    public function rsvp(Itinerary $itinerary, User $user, string $rsvp): Itinerary
    {
        if (! in_array($rsvp, ['going', 'maybe', 'declined'], true)) {
            abort(422, 'Invalid RSVP value.');
        }

        if ($itinerary->roleFor($user) === null) {
            abort(404);
        }

        $itinerary->members()->updateExistingPivot($user->id, ['rsvp' => $rsvp]);

        $this->activityLogger->recordChange($itinerary, 'member.rsvp', $user, null, ['rsvp' => $rsvp]);

        return $itinerary->fresh();
    }

    /**
     * Owner removes a member (or cancels a pending invite).
     */
    public function removeMember(Itinerary $itinerary, User $actor, User $target): void
    {
        if ((int) $actor->id === (int) $target->id) {
            $this->leave($itinerary, $actor);

            return;
        }

        $this->assertOwner($itinerary, $actor);

        $member = $itinerary->members()->whereKey($target->id)->first();

        if ($member === null) {
            abort(404);
        }

        $wasAccepted = $member->pivot->status === Itinerary::STATUS_ACCEPTED;

        DB::transaction(function () use ($itinerary, $actor, $target, $wasAccepted) {
            $itinerary->members()->detach($target->id);

            $this->syncTripType($itinerary);

            $this->activityLogger->recordChange($itinerary, 'member.removed', $actor, $target);

            if ($wasAccepted) {
                event(new TripMemberRemoved($itinerary, $actor, $target));
            }
        });
    }

    /**
     * A non-owner member leaves the trip.
     */
    public function leave(Itinerary $itinerary, User $user): void
    {
        if ($itinerary->roleFor($user) === Itinerary::ROLE_OWNER) {
            abort(403, 'The owner cannot leave their own trip. Transfer ownership first.');
        }

        $member = $itinerary->members()->whereKey($user->id)->first();

        if ($member === null) {
            abort(404);
        }

        DB::transaction(function () use ($itinerary, $user) {
            $itinerary->members()->detach($user->id);

            $this->syncTripType($itinerary);

            $this->activityLogger->recordChange($itinerary, 'member.left', $user, $user);
            event(new TripMemberLeft($itinerary, $user));
        });
    }

    public function changeRole(Itinerary $itinerary, User $actor, User $target, string $role): void
    {
        $this->assertOwner($itinerary, $actor);
        $role = $this->normalizeRole($role);

        if ((int) $target->id === (int) $itinerary->user_id) {
            abort(422, 'The owner role cannot be changed.');
        }

        $member = $itinerary->members()->whereKey($target->id)->first();

        if ($member === null) {
            abort(404);
        }

        DB::transaction(function () use ($itinerary, $actor, $target, $role) {
            $itinerary->members()->updateExistingPivot($target->id, ['role' => $role]);

            $this->activityLogger->recordChange($itinerary, 'member.role_changed', $actor, $target, [
                'role' => $role,
            ]);
            event(new TripMemberRoleChanged($itinerary, $actor, $target, $role));
        });
    }

    public function transferOwnership(Itinerary $itinerary, User $owner, int $newOwnerId): Itinerary
    {
        $this->assertOwner($itinerary, $owner);

        if ($newOwnerId === (int) $owner->id) {
            abort(422, 'You already own this trip.');
        }

        $newOwner = $itinerary->acceptedMembers()->whereKey($newOwnerId)->first();

        if ($newOwner === null) {
            abort(422, 'Ownership can only be transferred to an accepted member.');
        }

        DB::transaction(function () use ($itinerary, $owner, $newOwner) {
            $itinerary->members()->syncWithoutDetaching([
                $owner->id => [
                    'role' => Itinerary::ROLE_EDITOR,
                    'status' => Itinerary::STATUS_ACCEPTED,
                    'joined_at' => now(),
                ],
            ]);

            $itinerary->members()->detach($newOwner->id);

            $itinerary->forceFill(['user_id' => $newOwner->id])->save();
            $itinerary->unsetRelation('user');
            $itinerary->unsetRelation('members');

            $this->activityLogger->recordChange($itinerary, 'member.role_changed', $owner, $newOwner, [
                'transfer_ownership' => true,
                'new_owner_id' => $newOwner->id,
            ]);
            event(new TripOwnershipTransferred($itinerary, $owner, $newOwner));
        });

        return $itinerary->fresh();
    }

    /**
     * Part 1 hook: blocking cancels pending trip invitations between the two
     * users but never ejects members who already accepted.
     */
    public function cancelPendingInvitesBetween(User $a, User $b): void
    {
        $affected = DB::table('itinerary_user')
            ->where('status', Itinerary::STATUS_PENDING)
            ->where(function ($query) use ($a, $b) {
                $query->where(function ($query) use ($a, $b) {
                    $query->where('user_id', $a->id)
                        ->whereIn('itinerary_id', DB::table('itineraries')->select('id')->where('user_id', $b->id));
                })->orWhere(function ($query) use ($a, $b) {
                    $query->where('user_id', $b->id)
                        ->whereIn('itinerary_id', DB::table('itineraries')->select('id')->where('user_id', $a->id));
                });
            })
            ->pluck('itinerary_id')
            ->unique();

        DB::table('itinerary_user')
            ->where('status', Itinerary::STATUS_PENDING)
            ->where(function ($query) use ($a, $b) {
                $query->where(function ($query) use ($a, $b) {
                    $query->where('user_id', $a->id)
                        ->whereIn('itinerary_id', DB::table('itineraries')->select('id')->where('user_id', $b->id));
                })->orWhere(function ($query) use ($a, $b) {
                    $query->where('user_id', $b->id)
                        ->whereIn('itinerary_id', DB::table('itineraries')->select('id')->where('user_id', $a->id));
                });
            })
            ->delete();

        Itinerary::query()->whereKey($affected)->get()->each(fn (Itinerary $itinerary) => $this->syncTripType($itinerary));
    }

    /**
     * Create a share link invite. Returns the raw token exactly once.
     *
     * @return array{invite: ItineraryInvite, token: string}
     */
    public function createLink(
        Itinerary $itinerary,
        User $actor,
        string $role,
        ?int $expiresInDays = null,
        ?int $maxUses = null,
    ): array {
        $this->assertOwner($itinerary, $actor);
        $role = $this->normalizeRole($role);

        $maxInvites = (int) config('lakbai.sharing.max_invites', 20);
        $active = $itinerary->invites()->active()->count();

        if ($active >= $maxInvites) {
            throw ValidationException::withMessages([
                'invites' => "This trip has reached the active link limit ({$maxInvites}).",
            ]);
        }

        $rawToken = Str::random(64);
        $expiryDays = $expiresInDays ?? (int) config('lakbai.sharing.default_expiry_days', 7);

        $invite = $itinerary->invites()->create([
            'email' => null,
            'token' => hash('sha256', $rawToken),
            'role' => $role,
            'type' => 'link',
            'max_uses' => $maxUses,
            'uses_count' => 0,
            'expires_at' => $expiryDays > 0 ? now()->addDays($expiryDays) : null,
            'created_by' => $actor->id,
        ]);

        return ['invite' => $invite, 'token' => $rawToken];
    }

    public function previewLink(string $rawToken): ?ItineraryInvite
    {
        $invite = ItineraryInvite::query()
            ->where('token', hash('sha256', $rawToken))
            ->with('itinerary.user')
            ->first();

        if ($invite === null || ! $invite->isRedeemable()) {
            return null;
        }

        return $invite;
    }

    public function acceptLink(string $rawToken, User $user): Itinerary
    {
        return $this->acceptToken($rawToken, $user, false);
    }

    /**
     * Redeem an email or link token. Email invites additionally require the
     * signed-in user's email to match, and every redemption is blocked when
     * the owner and invitee have blocked each other.
     */
    public function acceptToken(string $rawToken, User $user, bool $enforceEmailMatch = true): Itinerary
    {
        return DB::transaction(function () use ($rawToken, $user, $enforceEmailMatch) {
            $invite = ItineraryInvite::query()
                ->where('token', hash('sha256', $rawToken))
                ->lockForUpdate()
                ->first();

            if ($invite === null || ! $invite->isRedeemable()) {
                abort(410, 'This invite link is invalid, expired, revoked or has already been used.');
            }

            $itinerary = Itinerary::query()->whereKey($invite->itinerary_id)->lockForUpdate()->firstOrFail();
            $itinerary->loadMissing('user');

            if ((int) $itinerary->user_id === (int) $user->id) {
                abort(403, 'The owner cannot accept their own invite.');
            }

            if ($enforceEmailMatch && $invite->type === 'email' && $invite->email !== null
                && strtolower($invite->email) !== strtolower((string) $user->email)) {
                abort(403, 'This invite was sent to a different email address.');
            }

            if ($itinerary->user !== null && $this->friends->isBlockedBetween($itinerary->user, $user)) {
                abort(403, 'You cannot join a trip shared by a user you have blocked or who has blocked you.');
            }

            $existing = $itinerary->members()->whereKey($user->id)->first();

            // Accepting twice is idempotent and must not consume another use.
            if ($existing !== null && $existing->pivot->status === Itinerary::STATUS_ACCEPTED) {
                return $itinerary;
            }

            if ($existing === null) {
                if ($this->memberAndPendingCount($itinerary) >= (int) config('lakbai.sharing.max_members', 20)) {
                    abort(422, 'This trip has reached the member limit.');
                }

                $itinerary->members()->attach($user->id, [
                    'role' => $invite->role,
                    'status' => Itinerary::STATUS_ACCEPTED,
                    'invited_by' => $invite->created_by,
                    'invited_at' => now(),
                    'responded_at' => now(),
                    'joined_at' => now(),
                ]);
            } else {
                // Keep the stronger role when a pending targeted invite already
                // grants more than the link being redeemed.
                $role = $existing->pivot->status === Itinerary::STATUS_PENDING
                    ? $this->strongerRole((string) $existing->pivot->role, $invite->role)
                    : $invite->role;

                $itinerary->members()->updateExistingPivot($user->id, [
                    'role' => $role,
                    'status' => Itinerary::STATUS_ACCEPTED,
                    'responded_at' => now(),
                    'joined_at' => now(),
                ]);
            }

            $invite->increment('uses_count');

            $this->syncTripType($itinerary);
            $this->activityLogger->recordChange($itinerary, 'member.joined', $user, $user);

            if ($invite->type === 'email') {
                event(new TripInviteAccepted($itinerary, $user, $invite->role));
            } else {
                event(new TripMemberJoinedViaLink($itinerary, $user, $invite->role));
            }

            return $itinerary->fresh();
        });
    }

    public function syncTripType(Itinerary $itinerary): void
    {
        $accepted = $itinerary->acceptedMembers()->count();
        $type = $accepted > 0 ? Itinerary::TRIP_GROUP : Itinerary::TRIP_SOLO;

        if ($itinerary->trip_type !== $type) {
            $itinerary->forceFill(['trip_type' => $type])->saveQuietly();
        }
    }

    public function memberAndPendingCount(Itinerary $itinerary): int
    {
        return $itinerary->members()
            ->wherePivotIn('status', [Itinerary::STATUS_ACCEPTED, Itinerary::STATUS_PENDING])
            ->count();
    }

    private function isActiveMember(Itinerary $itinerary, User $user): bool
    {
        return $itinerary->members()
            ->whereKey($user->id)
            ->wherePivotIn('status', [Itinerary::STATUS_ACCEPTED, Itinerary::STATUS_PENDING])
            ->exists();
    }

    private function assertOwner(Itinerary $itinerary, User $user): void
    {
        if ($itinerary->roleFor($user) !== Itinerary::ROLE_OWNER) {
            abort(403, 'Only the owner can manage this trip.');
        }
    }

    private function normalizeRole(string $role): string
    {
        if (! in_array($role, [Itinerary::ROLE_EDITOR, Itinerary::ROLE_VIEWER], true)) {
            throw ValidationException::withMessages([
                'role' => 'The role must be either editor or viewer.',
            ]);
        }

        return $role;
    }

    private function strongerRole(string $a, string $b): string
    {
        return $a === Itinerary::ROLE_EDITOR || $b === Itinerary::ROLE_EDITOR
            ? Itinerary::ROLE_EDITOR
            : Itinerary::ROLE_VIEWER;
    }
}
