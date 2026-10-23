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

<<<<<<< HEAD
    public function sentFriendRequests(): HasMany
    {
        return $this->hasMany(Friendship::class, 'requester_id');
    }

    public function receivedFriendRequests(): HasMany
    {
        return $this->hasMany(Friendship::class, 'addressee_id');
=======
    public function sharedItineraries(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Itinerary::class, 'itinerary_user')
            ->withPivot(['role', 'invited_by', 'joined_at'])
            ->withTimestamps();
>>>>>>> origin/main
    }
}
