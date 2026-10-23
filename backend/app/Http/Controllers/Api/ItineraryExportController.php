<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Itinerary;
use App\Services\Export\GpxExporter;
use App\Services\Export\IcsExporter;
use App\Services\Export\ItineraryExporter;
use App\Services\Export\PdfExporter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class ItineraryExportController extends Controller
{
    /**
     * @var array<string, ItineraryExporter>
     */
    private array $exporters;

    public function __construct(
        PdfExporter $pdf,
        IcsExporter $ics,
        GpxExporter $gpx,
    ) {
        $this->exporters = [
            $pdf->format() => $pdf,
            $ics->format() => $ics,
            $gpx->format() => $gpx,
        ];
    }

    /**
     * Download the itinerary as a PDF, calendar (.ics) or GPX file.
     */
    public function export(Request $request, Itinerary $itinerary): Response
    {
        Gate::authorize('export', $itinerary);

        $format = strtolower((string) $request->query('format', 'pdf'));

        if (! isset($this->exporters[$format])) {
            throw ValidationException::withMessages([
                'format' => 'Unsupported export format. Use pdf, ics or gpx.',
            ]);
        }

        $itinerary->load(['items.destination' => fn ($query) => $query->withTrashed()]);

        // Viewers may only see budgets when the owner explicitly shares them.
        // Exports must follow the same rule as the API projection.
        $role = $itinerary->roleFor($request->user());
        $itinerary->budgetVisible = $role !== Itinerary::ROLE_VIEWER || (bool) $itinerary->share_budget;
        $itinerary->items->each(fn ($item) => $item->budgetVisible = $itinerary->budgetVisible);

        return $this->exporters[$format]->download($itinerary);
    }
}
