<?php

namespace App\Services\Export;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\Response;

class GpxExporter extends AbstractItineraryExporter
{
    public function format(): string
    {
        return 'gpx';
    }

    public function extension(): string
    {
        return 'gpx';
    }

    public function download(Itinerary $itinerary): Response
    {
        $this->ensureNotEmpty($itinerary);

        $items = $this->orderedItems($itinerary);

        $lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<gpx version="1.1" creator="Lakbai" xmlns="http://www.topografix.com/GPX/1/1" '
                .'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                .'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
            '  <metadata>',
            '    <name>'.$this->xml($itinerary->title).'</name>',
        ];

        if ($itinerary->description) {
            $lines[] = '    <desc>'.$this->xml($itinerary->description).'</desc>';
        }

        $lines[] = '  </metadata>';

        foreach ($items as $item) {
            $coords = $item->resolvedCoordinates();

            if ($coords === null) {
                continue;
            }

            $lines[] = sprintf('  <wpt lat="%s" lon="%s">', $coords[0], $coords[1]);
            $lines[] = '    <name>'.$this->xml($item->resolvedTitle()).'</name>';

            $desc = $this->waypointDescription($item);
            if ($desc !== '') {
                $lines[] = '    <desc>'.$this->xml($desc).'</desc>';
            }

            $lines[] = '  </wpt>';
        }

        foreach ($items->groupBy('day_number')->sortKeys() as $dayNumber => $dayItems) {
            $routable = $dayItems->filter(fn (ItineraryItem $item) => $item->resolvedCoordinates() !== null);

            if ($routable->isEmpty()) {
                continue;
            }

            $lines[] = '  <rte>';
            $lines[] = '    <name>Day '.$dayNumber.'</name>';
            $lines = array_merge($lines, $this->routePoints($routable));
            $lines[] = '  </rte>';
        }

        $lines[] = '</gpx>';

        $body = implode("\n", $lines)."\n";

        return response($body, 200, [
            'Content-Type' => 'application/gpx+xml; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$this->filename($itinerary).'.gpx"',
        ]);
    }

    /**
     * @param  Collection<int, ItineraryItem>  $items
     * @return array<int, string>
     */
    private function routePoints(Collection $items): array
    {
        $lines = [];

        foreach ($items as $item) {
            $coords = $item->resolvedCoordinates();

            $lines[] = sprintf('    <rtept lat="%s" lon="%s">', $coords[0], $coords[1]);
            $lines[] = '      <name>'.$this->xml($item->resolvedTitle()).'</name>';
            $lines[] = '    </rtept>';
        }

        return $lines;
    }

    private function waypointDescription(ItineraryItem $item): string
    {
        $parts = [];

        if ($item->category) {
            $parts[] = $item->category;
        }

        if ($item->notes) {
            $parts[] = $item->notes;
        }

        if ($item->estimated_budget !== null) {
            $parts[] = 'Budget: PHP '.$item->estimated_budget;
        }

        return implode(' — ', $parts);
    }

    private function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
