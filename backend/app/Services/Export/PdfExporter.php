<?php

namespace App\Services\Export;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Symfony\Component\HttpFoundation\Response;

class PdfExporter extends AbstractItineraryExporter
{
    public function format(): string
    {
        return 'pdf';
    }

    public function extension(): string
    {
        return 'pdf';
    }

    public function download(Itinerary $itinerary): Response
    {
        $this->ensureNotEmpty($itinerary);

        $days = $this->orderedItems($itinerary)
            ->groupBy('day_number')
            ->sortKeys()
            ->map(fn ($items, $day) => [
                'day_number' => (int) $day,
                'date' => $this->dateForDay($itinerary, (int) $day)?->toDateString(),
                'items' => $items->values(),
                'budget' => (float) $items->sum('estimated_budget'),
                'duration' => (int) $items->sum('duration_minutes'),
            ])
            ->values();

        // DejaVu Sans (bundled with dompdf) renders the Philippine peso sign "₱".
        $pdf = Pdf::loadView('exports.itinerary', [
            'itinerary' => $itinerary,
            'days' => $days,
            'totalEstimated' => (float) $itinerary->items->sum('estimated_budget'),
            'budgetLimit' => $itinerary->total_budget !== null || $itinerary->budget !== null
                ? (float) ($itinerary->total_budget ?? $itinerary->budget)
                : null,
            'mapLink' => fn (ItineraryItem $item) => $this->mapLink($item),
        ])
            ->setPaper('a4')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isRemoteEnabled', false);

        return $pdf->download($this->filename($itinerary).'.pdf');
    }

    private function mapLink(ItineraryItem $item): ?string
    {
        $coords = $item->resolvedCoordinates();

        if ($coords === null) {
            return null;
        }

        return sprintf('https://www.openstreetmap.org/?mlat=%s&mlon=%s#map=16/%s/%s', $coords[0], $coords[1], $coords[0], $coords[1]);
    }
}
