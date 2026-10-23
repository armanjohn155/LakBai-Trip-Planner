<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Friendship extends Model
{
    use HasFactory;

    protected $fillable = [
        'requester_id',
        'addressee_id',
        'status',
        'blocked_by',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'responded_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function addressee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'addressee_id');
    }

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_by');
    }

    public function involves(User $user): bool
    {
        return $this->requester_id === $user->id || $this->addressee_id === $user->id;
    }

    public function otherUser(User $user): ?User
    {
        if ($this->requester_id === $user->id) {
            return $this->addressee;
        }
        if ($this->addressee_id === $user->id) {
            return $this->requester;
        }

        return null;
    }
}
