<?php

namespace App\Models;

use Database\Factories\DestinationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'name',
    'description',
    'category',
    'region',
    'municipality',
    'latitude',
    'longitude',
    'radius_m',
    'estimated_cost',
    'image_url',
    'best_time_to_visit',
    'tips',
])]
class Destination extends Model
{
    /** @use HasFactory<DestinationFactory> */
    use HasFactory, SoftDeletes;

    public const REGIONS = ['Metro Cebu', 'North Cebu', 'South Cebu'];

    public const CATEGORIES = [
        'Beach',
        'Waterfall',
        'Mountains & Hiking',
        'Historical & Cultural',
        'Religious Sites',
        'Food & Restaurants',
        'Diving & Water Activities',
        'Nature & Eco-Tourism',
        'Islands',
    ];

    public const MUNICIPALITIES = [
        'Cebu City',
        'Badian',
        'Bantayan',
        'Moalboal',
        'Oslob',
        'Dalaguete',
    ];

    /**
     * The model's default values for attributes.
     *
     * rating and review_count are system-managed: they default to zero for new
     * destinations and are deliberately excluded from mass assignment.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'rating' => 0,
        'review_count' => 0,
        'radius_m' => 150,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'radius_m' => 'integer',
            'estimated_cost' => 'decimal:2',
            'rating' => 'decimal:1',
            'review_count' => 'integer',
            'base_rating' => 'decimal:1',
            'base_review_count' => 'integer',
            'lakbai_rating_avg' => 'decimal:2',
            'lakbai_review_count' => 'integer',
        ];
    }

    public function itineraryItems(): HasMany
    {
        return $this->hasMany(ItineraryItem::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'favorites')->withTimestamps();
    }

    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['category'] ?? null, fn (Builder $query, string $category) => $query->where('category', $category))
            ->when($filters['region'] ?? null, fn (Builder $query, string $region) => $query->where('region', $region))
            ->when($filters['search'] ?? null, fn (Builder $query, string $search) => $query->where('name', 'like', "%{$search}%"))
            ->when($filters['min_price'] ?? null, fn (Builder $query, $min) => $query->where('estimated_cost', '>=', $min))
            ->when($filters['max_price'] ?? null, fn (Builder $query, $max) => $query->where('estimated_cost', '<=', $max));
    }
}
