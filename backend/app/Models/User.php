<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'avatar_url', 'username', 'friend_code', 'friend_code_regenerated_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'friend_code_regenerated_at' => 'datetime',
        ];
    }

    /**
     * Determine whether the user holds the administrator role.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function itineraries(): HasMany
    {
        return $this->hasMany(Itinerary::class);
    }

    /**
     * Itineraries shared with this user (where they are a member, not owner).
     */
    public function sharedItineraries(): BelongsToMany
    {
        return $this->belongsToMany(Itinerary::class, 'itinerary_user')
            ->withPivot(['role', 'status', 'rsvp', 'invited_by', 'invited_at', 'responded_at', 'joined_at'])
            ->withTimestamps();
    }

    /**
     * Invites this user created for other users.
     */
    public function createdItineraryInvites(): HasMany
    {
        return $this->hasMany(ItineraryInvite::class, 'created_by');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function favoriteDestinations(): BelongsToMany
    {
        return $this->belongsToMany(Destination::class, 'favorites')->withTimestamps();
    }

    public function settings(): HasOne
    {
        return $this->hasOne(UserSettings::class);
    }

    public function sentFriendRequests(): HasMany
    {
        return $this->hasMany(Friendship::class, 'requester_id');
    }

    public function receivedFriendRequests(): HasMany
    {
        return $this->hasMany(Friendship::class, 'addressee_id');
    }

    public static function generateUsername(string $name, ?int $excludeId = null): string
    {
        $base = Str::slug($name, '_');
        $base = strtolower(preg_replace('/[^a-z0-9_]/', '', $base) ?: 'user');
        if (strlen($base) < 3) {
            $base = $base.'user';
        }
        $base = substr($base, 0, 12);

        $username = $base;
        $i = 0;
        while (static::query()->where('username', $username)->when($excludeId, fn ($q, $id) => $q->where('id', '!=', $id))->exists()) {
            $i++;
            $suffix = (string) $i;
            $username = substr($base, 0, max(3, 12 - strlen($suffix))).$suffix;
        }

        return $username;
    }

    public static function generateFriendCode(?int $excludeId = null): string
    {
        $chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        do {
            $code = 'LAKBAI-';
            for ($i = 0; $i < 6; $i++) {
                $code .= $chars[random_int(0, strlen($chars) - 1)];
            }
        } while (static::query()->where('friend_code', $code)->when($excludeId, fn ($q, $id) => $q->where('id', '!=', $id))->exists());

        return $code;
    }
}
