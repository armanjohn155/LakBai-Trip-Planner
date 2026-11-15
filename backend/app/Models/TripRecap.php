<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

#[Fillable([
    'itinerary_id',
    'title',
    'summary',
    'cover_photo_id',
    'visibility',
    'share_token_hash',
    'share_expires_at',
    'hide_endpoints',
    'show_stats',
    'show_photos',
    'theme_accent',
    'route_geojson',
    'stats',
])]
class TripRecap extends Model
{
    public const VISIBILITY_PRIVATE = 'private';

    public const VISIBILITY_MEMBERS = 'members';

    public const VISIBILITY_LINK = 'link';

    public const VISIBILITY_PUBLIC = 'public';

    public const VISIBILITIES = [
        self::VISIBILITY_PRIVATE,
        self::VISIBILITY_MEMBERS,
        self::VISIBILITY_LINK,
        self::VISIBILITY_PUBLIC,
    ];

    public const ACCENTS = ['surf', 'mango', 'magenta', 'sea', 'royal'];

    protected function casts(): array
    {
        return [
            'cover_photo_id' => 'integer',
            'share_expires_at' => 'datetime',
            'hide_endpoints' => 'boolean',
            'show_stats' => 'boolean',
            'show_photos' => 'boolean',
            'route_geojson' => 'array',
            'stats' => 'array',
        ];
    }

    public function itinerary(): BelongsTo
    {
        return $this->belongsTo(Itinerary::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(TripPhoto::class, 'itinerary_id', 'itinerary_id');
    }

    public function coverPhoto(): BelongsTo
    {
        return $this->belongsTo(TripPhoto::class, 'cover_photo_id');
    }

    /**
     * Resolve a plaintext share token without ever storing the plaintext.
     */
    public static function findByShareToken(?string $token): ?self
    {
        if ($token === null || trim($token) === '') {
            return null;
        }

        return static::query()
            ->where('share_token_hash', hash('sha256', $token))
            ->first();
    }

    public function shareIsActive(?Carbon $now = null): bool
    {
        if ($this->share_token_hash === null) {
            return false;
        }

        $now ??= Carbon::now();

        return $this->share_expires_at === null || $this->share_expires_at->isFuture();
    }

    /**
     * A token is required for every public read; "link" and "public" only
     * differ in whether a future listing may surface the recap.
     */
    public function isPubliclyVisible(?Carbon $now = null): bool
    {
        return in_array($this->visibility, [self::VISIBILITY_LINK, self::VISIBILITY_PUBLIC], true)
            && $this->shareIsActive($now);
    }

    public function canBeViewedBy(User $user): bool
    {
        return $this->itinerary()->first()?->roleFor($user) !== null;
    }
}
