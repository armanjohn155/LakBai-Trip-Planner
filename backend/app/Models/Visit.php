<?php

namespace App\Models;

use Database\Factories\VisitFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'destination_id',
    'itinerary_stop_id',
    'verified',
    'method',
    'latitude',
    'longitude',
    'distance_m',
    'accuracy_m',
    'visited_at',
    'superseded_at',
    'superseded_by_visit_id',
    'notes',
])]
class Visit extends Model
{
    /** @use HasFactory<VisitFactory> */
    use HasFactory;

    public const METHODS = ['gps', 'manual'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'verified' => 'boolean',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'distance_m' => 'integer',
            'accuracy_m' => 'integer',
            'visited_at' => 'datetime',
            'superseded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The destination for this visit. Trashed destinations are included so a
     * user's history survives a soft delete.
     */
    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class)->withTrashed();
    }

    public function itineraryStop(): BelongsTo
    {
        return $this->belongsTo(ItineraryItem::class, 'itinerary_stop_id');
    }

    /**
     * The verified visit that replaced an earlier manual visit.
     */
    public function supersededBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'superseded_by_visit_id');
    }

    public function scopeVerified(Builder $query): Builder
    {
        return $query->where('verified', true);
    }

    public function scopeNotSuperseded(Builder $query): Builder
    {
        return $query->whereNull('superseded_at');
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->whereBelongsTo($user);
    }
}
