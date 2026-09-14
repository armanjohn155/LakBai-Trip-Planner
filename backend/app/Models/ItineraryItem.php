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
    'day_number',
    'order',
    'estimated_budget',
    'notes',
    'visited',
])]
class ItineraryItem extends Model
{
    /** @use HasFactory<ItineraryItemFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'day_number' => 'integer',
            'order' => 'integer',
            'estimated_budget' => 'decimal:2',
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
}
