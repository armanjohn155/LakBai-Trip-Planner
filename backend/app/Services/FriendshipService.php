<?php

namespace App\Services;

use App\Events\FriendRequestAccepted;
use App\Events\FriendRequestDeclined;
use App\Events\FriendRequestSent;
use App\Events\Unfriended;
use App\Events\UserBlocked;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FriendshipService
{
    public function areFriends(User $a, User $b): bool
    {
        return Friendship::query()
            ->where('status', 'accepted')
            ->where(function ($q) use ($a, $b) {
                $q->where(function ($q) use ($a, $b) {
                    $q->where('requester_id', $a->id)->where('addressee_id', $b->id);
                })->orWhere(function ($q) use ($a, $b) {
                    $q->where('requester_id', $b->id)->where('addressee_id', $a->id);
                });
            })
            ->exists();
    }

    public function isBlockedBetween(User $a, User $b): bool
    {
        return Friendship::query()
            ->where('status', 'blocked')
            ->where(function ($q) use ($a, $b) {
                $q->where('requester_id', $a->id)->where('addressee_id', $b->id)
                    ->orWhere(function ($q) use ($a, $b) {
                        $q->where('requester_id', $b->id)->where('addressee_id', $a->id);
                    });
            })
            ->exists();
    }

    public function findFriendship(User $a, User $b): ?Friendship
    {
        return Friendship::query()
            ->where(function ($q) use ($a, $b) {
                $q->where('requester_id', $a->id)->where('addressee_id', $b->id);
            })
            ->orWhere(function ($q) use ($a, $b) {
                $q->where('requester_id', $b->id)->where('addressee_id', $a->id);
            })
            ->first();
    }

    public function send(User $requester, User $addressee): Friendship
    {
        if ($requester->id === $addressee->id) {
            abort(422, 'You cannot send a friend request to yourself.');
        }

        if ($this->isBlockedBetween($requester, $addressee)) {
            throw ValidationException::withMessages([
                'identifier' => 'If that user exists, a request was sent.',
            ]);
        }

        $existing = $this->findFriendship($requester, $addressee);

        if ($existing && $existing->status === 'accepted') {
            throw ValidationException::withMessages([
                'identifier' => 'If that user exists, a request was sent.',
            ]);
        }

        if ($existing && $existing->status === 'pending') {
            // If the other user already sent you a request, sending one back accepts it.
            if ($existing->addressee_id === $requester->id) {
                return $this->accept($requester, $existing);
            }

            throw ValidationException::withMessages([
                'identifier' => 'If that user exists, a request was sent.',
            ]);
        }

        if ($existing && $existing->status === 'declined') {
            $cooldownDays = (int) config('lakbai.friends.resend_cooldown_days', 7);
            $lastResponded = $existing->responded_at;

            if ($lastResponded && $lastResponded->copy()->addDays($cooldownDays)->isFuture()) {
                throw ValidationException::withMessages([
                    'identifier' => 'If that user exists, a request was sent.',
                ]);
            }

            $existing->update([
                'requester_id' => $requester->id,
                'addressee_id' => $addressee->id,
                'status' => 'pending',
                'blocked_by' => null,
                'responded_at' => null,
            ]);

            event(new FriendRequestSent($existing, $requester, $addressee));

            return $existing->fresh();
        }

        if ($existing && $existing->status === 'blocked') {
            throw ValidationException::withMessages([
                'identifier' => 'If that user exists, a request was sent.',
            ]);
        }

        $friendship = Friendship::create([
            'requester_id' => $requester->id,
            'addressee_id' => $addressee->id,
            'status' => 'pending',
        ]);

        event(new FriendRequestSent($friendship, $requester, $addressee));

        return $friendship;
    }

    public function accept(User $user, Friendship $friendship): Friendship
    {
        if ($friendship->addressee_id !== $user->id) {
            abort(404);
        }

        if ($friendship->status !== 'pending') {
            abort(404);
        }

        $friendship->update([
            'status' => 'accepted',
            'responded_at' => now(),
            'blocked_by' => null,
        ]);

        event(new FriendRequestAccepted($friendship, $friendship->requester, $friendship->addressee));

        return $friendship->fresh();
    }

    public function decline(User $user, Friendship $friendship): Friendship
    {
        if ($friendship->addressee_id !== $user->id) {
            abort(404);
        }

        if ($friendship->status !== 'pending') {
            abort(404);
        }

        $friendship->update([
            'status' => 'declined',
            'responded_at' => now(),
            'blocked_by' => null,
        ]);

        event(new FriendRequestDeclined($friendship, $friendship->requester, $friendship->addressee));

        return $friendship->fresh();
    }

    public function cancel(User $user, Friendship $friendship): void
    {
        if ($friendship->requester_id !== $user->id) {
            abort(404);
        }

        if ($friendship->status !== 'pending') {
            abort(404);
        }

        $friendship->delete();
    }

    public function unfriend(User $user, User $friend): void
    {
        DB::transaction(function () use ($user, $friend) {
            $friendship = $this->findFriendship($user, $friend);

            if ($friendship && $friendship->status === 'accepted') {
                $friendship->delete();
            } elseif ($friendship && $friendship->status === 'pending') {
                // If pending either direction, allow unfriend to remove it
                $friendship->delete();
            }

            event(new Unfriended($user, $friend));
        });
    }

    public function block(User $blocker, User $blocked): Friendship
    {
        if ($blocker->id === $blocked->id) {
            abort(422, 'You cannot block yourself.');
        }

        return DB::transaction(function () use ($blocker, $blocked) {
            $existing = $this->findFriendship($blocker, $blocked);

            if ($existing) {
                $existing->delete();
            }

            // Remove pending requests in either direction (already handled by delete)
            $friendship = Friendship::create([
                'requester_id' => $blocker->id,
                'addressee_id' => $blocked->id,
                'status' => 'blocked',
                'blocked_by' => $blocker->id,
                'responded_at' => now(),
            ]);

            // Part 2 hook: blocking cancels pending trip invites between the two
            // users but never ejects members who already accepted.
            app(TripInvitationService::class)->cancelPendingInvitesBetween($blocker, $blocked);

            event(new UserBlocked($blocker, $blocked));

            return $friendship;
        });
    }

    public function unblock(User $blocker, User $blocked): void
    {
        $friendship = Friendship::query()
            ->where('requester_id', $blocker->id)
            ->where('addressee_id', $blocked->id)
            ->where('status', 'blocked')
            ->first();

        if ($friendship) {
            $friendship->delete();
        }
    }
}
