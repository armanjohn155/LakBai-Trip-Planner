<?php

namespace App\Models;

use Database\Factories\ItineraryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'title', 'start_date', 'end_date', 'budget'])]
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

    public function getTotalBudgetAttribute(): float
    {
        return (float) $this->items->sum('estimated_budget');
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->whereBelongsTo($user);
    }
}
