<?php

namespace App\Models;

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

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'max_uses' => 'integer',
            'uses_count' => 'integer',
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
    }
}
