<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'itinerary_id',
    'user_id',
    'status',
    'shared_with_group',
    'ever_shared_with_group',
    'started_at',
    'ended_at',
    'distance_m',
    'last_lat',
    'last_lng',
    'last_accuracy_m',
    'last_point_at',
])]
class TrackingSession extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAUSED = 'paused';

    public const STATUS_ENDED = 'ended';

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_point_at' => 'datetime',
            'shared_with_group' => 'boolean',
            'ever_shared_with_group' => 'boolean',
            'distance_m' => 'integer',
            'last_lat' => 'decimal:7',
            'last_lng' => 'decimal:7',
            'last_accuracy_m' => 'integer',
        ];
    }

    public function itinerary(): BelongsTo
    {
        return $this->belongsTo(Itinerary::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function points(): HasMany
    {
        return $this->hasMany(TrackingPoint::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeShared(Builder $query): Builder
    {
        return $query->where('shared_with_group', true);
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->whereBelongsTo($user);
    }
}
