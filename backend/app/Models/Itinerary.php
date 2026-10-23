<?php

namespace App\Models;

use Database\Factories\ItineraryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'title',
    'description',
    'start_date',
    'end_date',
    'budget',
    'total_budget',
    'cover_image_url',
    'is_template',
    'template_key',
<<<<<<< HEAD
    'trip_type',
=======
>>>>>>> origin/main
    'version',
    'updated_by',
    'share_budget',
])]
class Itinerary extends Model
{
    /** @use HasFactory<ItineraryFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'budget' => 'decimal:2',
            'total_budget' => 'decimal:2',
            'is_template' => 'boolean',
<<<<<<< HEAD
            'version' => 'integer',
            'share_budget' => 'boolean',
=======
            'share_budget' => 'boolean',
            'version' => 'integer',
>>>>>>> origin/main
        ];
    }

    /**
<<<<<<< HEAD
     * Scope implicit route binding to itineraries the authenticated user can
     * access (owner or member). Non-members resolve as not found (404) rather
     * than forbidden, so private itineraries are never leaked.
     *
     * @param  Builder  $query
     */
    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        return parent::resolveRouteBindingQuery($query, $value, $field)
            ->when(request()->user() !== null, fn (Builder $query) => $query->accessibleBy(request()->user()));
=======
     * Scope implicit route binding to allow owner or shared members; non-members resolve as not found (404).
     */
    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        $user = request()?->user();

        $query = parent::resolveRouteBindingQuery($query, $value, $field);

        if ($user === null) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($user) {
            $q->where('user_id', $user->id)
                ->orWhereHas('members', fn (Builder $m) => $m->where('users.id', $user->id));
        });
>>>>>>> origin/main
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public const ROLE_OWNER = 'owner';

    public const ROLE_EDITOR = 'editor';

    public const ROLE_VIEWER = 'viewer';

    public const TRIP_SOLO = 'solo';

    public const TRIP_GROUP = 'group';

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_DECLINED = 'declined';

    /**
     * Collaborators, excluding the owner. The pivot carries the role, invite
     * status and RSVP.
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'itinerary_user')
            ->withPivot(['role', 'status', 'rsvp', 'invited_by', 'invited_at', 'responded_at', 'joined_at'])
            ->withTimestamps();
    }

    /**
     * Collaborators who have accepted their invitation.
     */
    public function acceptedMembers(): BelongsToMany
    {
        return $this->members()->wherePivot('status', self::STATUS_ACCEPTED);
    }

    public function invites(): HasMany
    {
        return $this->hasMany(ItineraryInvite::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(ItineraryActivity::class)->latest('id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ItineraryItem::class)
            ->orderBy('day_number')
            ->orderBy('order');
    }

    public function members(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(User::class, 'itinerary_user')
            ->withPivot(['role', 'invited_by', 'joined_at'])
            ->withTimestamps();
    }

    public function invites(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ItineraryInvite::class);
    }

    public function activities(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ItineraryActivity::class)->orderByDesc('created_at');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $q) use ($user) {
            $q->where('user_id', $user->id)
                ->orWhereHas('members', fn (Builder $m) => $m->where('users.id', $user->id));
        });
    }

    public function roleFor(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        if ($this->user_id === $user->id) {
            return 'owner';
        }

        $role = $this->members()->where('users.id', $user->id)->first()?->pivot?->role;

        return $role;
    }

    public function isMember(User $user): bool
    {
        return $this->roleFor($user) !== null;
    }

    /**
     * Eager-load the stops with soft-deleted destinations included and flag
     * each stop with whether the given user has a *verified* visit there.
     *
     * One extra query for all stops; safe to call on index/show/after-mutation
     * responses so the client can render "Verified" without N+1.
     */
    public function loadForDisplay(?User $user = null): static
    {
        $this->load([
            'updatedBy',
            'items.destination' => fn ($query) => $query->withTrashed(),
            'items.updatedBy',
        ]);

        if ($user === null) {
            return $this;
        }

        $destinationIds = $this->items
            ->pluck('destination_id')
            ->filter()
            ->unique()
            ->values();

        if ($destinationIds->isEmpty()) {
            return $this;
        }

        $verifiedIds = Visit::query()
            ->where('user_id', $user->id)
            ->verified()
            ->whereIn('destination_id', $destinationIds)
            ->pluck('destination_id')
            ->unique();

        $this->items->each(function (ItineraryItem $item) use ($verifiedIds) {
            $item->verified = $item->destination_id !== null
                && $verifiedIds->contains($item->destination_id);
        });

        return $this;
    }

    /**
     * Number of days in the itinerary: derived from dates when present,
     * otherwise from the highest day number used by a stop, else 1.
     */
    public function dayCount(): int
    {
        if ($this->start_date !== null && $this->end_date !== null) {
            return max(1, $this->start_date->diffInDays($this->end_date) + 1);
        }

        $maxDay = (int) collect($this->items)->max('day_number');

        return max(1, $maxDay);
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->whereBelongsTo($user);
    }

    /**
     * Itineraries the user owns or has accepted a membership on. Pending
     * invitees are intentionally excluded (they see only a preview).
     */
    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $query) use ($user) {
            $query->whereBelongsTo($user)
                ->orWhereHas('members', fn (Builder $members) => $members
                    ->whereKey($user->id)
                    ->wherePivot('status', self::STATUS_ACCEPTED));
        });
    }

    /**
     * The membership pivot status for the user, or null when they are not a
     * member at all. Owners are treated as accepted.
     */
    public function statusFor(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        if ((int) $this->user_id === (int) $user->id) {
            return self::STATUS_ACCEPTED;
        }

        $member = $this->relationLoaded('members')
            ? $this->members->firstWhere('id', $user->id)
            : $this->members()->whereKey($user->id)->first();

        return $member?->pivot?->status;
    }

    /**
     * The user's role on this itinerary: owner, editor, viewer, or null when
     * they have no *accepted* access. Owners always win over a stale pivot row.
     */
    public function roleFor(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        if ((int) $this->user_id === (int) $user->id) {
            return self::ROLE_OWNER;
        }

        $member = $this->relationLoaded('members')
            ? $this->members->firstWhere('id', $user->id)
            : $this->members()->whereKey($user->id)->first();

        if ($member === null) {
            return null;
        }

        if (($member->pivot->status ?? null) !== self::STATUS_ACCEPTED) {
            return null;
        }

        $role = $member->pivot->role ?? null;

        return in_array($role, [self::ROLE_EDITOR, self::ROLE_VIEWER], true) ? $role : self::ROLE_VIEWER;
    }

    /**
     * Whether the user may edit stops/details (owner or editor).
     */
    public function isEditableBy(?User $user): bool
    {
        $role = $this->roleFor($user);

        return $role === self::ROLE_OWNER || $role === self::ROLE_EDITOR;
    }

    /**
     * Itineraries the user has been invited to but has not yet accepted.
     */
    public function scopePendingFor(Builder $query, User $user): Builder
    {
        return $query->whereHas('members', fn (Builder $members) => $members
            ->whereKey($user->id)
            ->wherePivot('status', self::STATUS_PENDING));
    }

    /**
     * Only admin-curated templates that are safe to expose to end users.
     */
    public function scopeTemplates(Builder $query): Builder
    {
        return $query->where('is_template', true);
    }
}
