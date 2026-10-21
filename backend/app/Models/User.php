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

#[Fillable(['name', 'email', 'password', 'avatar_url'])]
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

    public function sharedItineraries(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Itinerary::class, 'itinerary_user')
            ->withPivot(['role', 'invited_by', 'joined_at'])
            ->withTimestamps();
    }
}
