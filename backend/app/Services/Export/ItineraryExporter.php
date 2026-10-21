<?php

namespace App\Services\Export;

use App\Models\Itinerary;
use Symfony\Component\HttpFoundation\Response;

interface ItineraryExporter
{
    /**
     * The format keyword this exporter handles (pdf|ics|gpx).
     */
    public function format(): string;

    /**
     * The file extension (without the dot).
     */
    public function extension(): string;

    /**
     * Render the itinerary as a downloadable HTTP response.
     *
     * Implementations may throw \Illuminate\Validation\ValidationException for
     * unsatisfiable requests (e.g. ICS without dates, empty itinerary).
     */
    public function download(Itinerary $itinerary): Response;

    /**
     * Slugged base filename (without extension) for the download, e.g.
     * "lakbai-3-day-south-cebu".
     */
    public function filename(Itinerary $itinerary): string;
}
