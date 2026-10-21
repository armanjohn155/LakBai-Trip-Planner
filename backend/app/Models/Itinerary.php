<?php

namespace App\Models;

use Database\Factories\ItineraryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        ];
    }

    /**
     * Scope implicit route binding to the authenticated user so that other
     * users' itineraries resolve as not found (404) rather than forbidden.
     *
     * @param  Builder  $query
     */
    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        return parent::resolveRouteBindingQuery($query, $value, $field)
            ->when(request()->user() !== null, fn (Builder $query) => $query->where('user_id', request()->user()->id));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ItineraryItem::class)
            ->orderBy('day_number')
            ->orderBy('order');
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
        $this->load(['items.destination' => fn ($query) => $query->withTrashed()]);

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
     * Only admin-curated templates that are safe to expose to end users.
     */
    public function scopeTemplates(Builder $query): Builder
    {
        return $query->where('is_template', true);
    }
}
