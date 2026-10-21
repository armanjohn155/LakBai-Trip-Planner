<?php

namespace App\Services\Export;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

abstract class AbstractItineraryExporter implements ItineraryExporter
{
    /**
     * Ensure the itinerary has at least one stop to export.
     */
    protected function ensureNotEmpty(Itinerary $itinerary): void
    {
        if ($itinerary->items->isEmpty()) {
            throw ValidationException::withMessages([
                'itinerary' => 'Add at least one stop before exporting this itinerary.',
            ]);
        }
    }

    public function filename(Itinerary $itinerary): string
    {
        $dayCount = max($itinerary->dayCount(), 1);

        return 'lakbai-'.$dayCount.'-day-'.Str::slug($itinerary->title);
    }

    /**
     * The stops in display order (by day then position).
     *
     * @return Collection<int, ItineraryItem>
     */
    protected function orderedItems(Itinerary $itinerary): Collection
    {
        return $itinerary->items
            ->sortBy([
                ['day_number', 'asc'],
                ['order', 'asc'],
            ])
            ->values();
    }

    /**
     * The calendar date for a day number, or null when dates are not set.
     */
    protected function dateForDay(Itinerary $itinerary, int $dayNumber): ?Carbon
    {
        if ($itinerary->start_date === null) {
            return null;
        }

        return $itinerary->start_date->copy()->addDays(max($dayNumber, 1) - 1);
    }

    /**
     * A plain-text location line for a stop (address or coordinates).
     */
    protected function locationLine(ItineraryItem $item): string
    {
        if ($item->custom_address) {
            return $item->custom_address;
        }

        $coords = $item->resolvedCoordinates();

        if ($coords !== null) {
            return sprintf('%.5f, %.5f', $coords[0], $coords[1]);
        }

        return $item->resolvedTitle();
    }
}
