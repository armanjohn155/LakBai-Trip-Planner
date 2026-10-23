<?php

namespace App\Models;

<<<<<<< HEAD
use Database\Factories\ItineraryInviteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'itinerary_id',
    'email',
    'token',
    'role',
    'type',
    'max_uses',
    'uses_count',
    'expires_at',
    'revoked_at',
    'created_by',
])]
class ItineraryInvite extends Model
{
    /** @use HasFactory<ItineraryInviteFactory> */
    use HasFactory;

    public const ROLES = ['editor', 'viewer'];

    public const TYPES = ['email', 'link'];
=======
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItineraryInvite extends Model
{
    protected $fillable = [
        'itinerary_id',
        'email',
        'token_hash',
        'role',
        'type',
        'max_uses',
        'uses_count',
        'expires_at',
        'revoked_at',
        'created_by',
    ];
>>>>>>> origin/main

    protected function casts(): array
    {
        return [
<<<<<<< HEAD
            'max_uses' => 'integer',
            'uses_count' => 'integer',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
=======
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'max_uses' => 'integer',
            'uses_count' => 'integer',
>>>>>>> origin/main
        ];
    }

    public function itinerary(): BelongsTo
    {
        return $this->belongsTo(Itinerary::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

<<<<<<< HEAD
    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isExhausted(): bool
    {
        return $this->max_uses !== null && $this->uses_count >= $this->max_uses;
    }

    public function isRedeemable(): bool
    {
        return ! $this->isRevoked() && ! $this->isExpired() && ! $this->isExhausted();
    }

    /**
     * Scope to invites that can still be used.
     */
    public function scopeActive(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query
            ->whereNull('revoked_at')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->where(function ($query) {
                $query->whereNull('max_uses')->orWhereRaw('uses_count < max_uses');
            });
=======
    public function isValid(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        if ($this->expires_at !== null && $this->expires_at->isPast()) {
            return false;
        }

        if ($this->max_uses !== null && $this->uses_count >= $this->max_uses) {
            return false;
        }

        return true;
>>>>>>> origin/main
    }
}
