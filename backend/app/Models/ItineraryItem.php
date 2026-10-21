<?php

namespace App\Models;

use Database\Factories\ItineraryItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'itinerary_id',
    'destination_id',
    'custom_title',
    'custom_latitude',
    'custom_longitude',
    'custom_address',
    'day_number',
    'order',
    'start_time',
    'duration_minutes',
    'category',
    'estimated_budget',
    'notes',
    'visited',
    'status',
])]
class ItineraryItem extends Model
{
    /** @use HasFactory<ItineraryItemFactory> */
    use HasFactory;

    public const STATUSES = ['planned', 'done', 'skipped'];

    /**
     * Custom (destination-less) categories, in addition to Destination::CATEGORIES.
     */
    public const CUSTOM_CATEGORIES = ['Transport', 'Accommodation', 'Meal', 'Other'];

    protected function casts(): array
    {
        return [
            'day_number' => 'integer',
            'order' => 'integer',
            'duration_minutes' => 'integer',
            'estimated_budget' => 'decimal:2',
            'custom_latitude' => 'decimal:7',
            'custom_longitude' => 'decimal:7',
            'visited' => 'boolean',
        ];
    }

    /**
     * Scope implicit route binding to the itinerary resolved in the current
     * request so cross-itinerary items resolve as not found (404).
     *
     * @param  Builder  $query
     */
    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        $itinerary = request()->route('itinerary');

        return parent::resolveRouteBindingQuery($query, $value, $field)
            ->when($itinerary !== null, fn (Builder $query) => $query->where('itinerary_id', $itinerary->id));
    }

    public function itinerary(): BelongsTo
    {
        return $this->belongsTo(Itinerary::class);
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class);
    }

    /**
     * A custom stop has no destination and carries its own details.
     */
    public function isCustom(): bool
    {
        return $this->destination_id === null;
    }

    /**
     * Display title: the destination name when linked, else the custom title.
     */
    public function resolvedTitle(): string
    {
        if ($this->destination_id !== null && $this->destination !== null) {
            return $this->destination->name;
        }

        return $this->custom_title ?? 'Untitled stop';
    }

    /**
     * Category: destination category, else the custom category, else "Other".
     */
    public function resolvedCategory(): ?string
    {
        if ($this->destination_id !== null && $this->destination !== null) {
            return $this->destination->category;
        }

        return $this->category ?? 'Other';
    }

    /**
     * Coordinates as [lat, lng] floats when known, else null.
     *
     * @return array{0: float, 1: float}|null
     */
    public function resolvedCoordinates(): ?array
    {
        if ($this->destination_id !== null && $this->destination !== null
            && $this->destination->latitude !== null && $this->destination->longitude !== null) {
            return [(float) $this->destination->latitude, (float) $this->destination->longitude];
        }

        if ($this->custom_latitude !== null && $this->custom_longitude !== null) {
            return [(float) $this->custom_latitude, (float) $this->custom_longitude];
        }

        return null;
    }
}
