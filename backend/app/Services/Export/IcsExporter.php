<?php

namespace App\Services\Export;

use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class IcsExporter extends AbstractItineraryExporter
{
    public function format(): string
    {
        return 'ics';
    }

    public function extension(): string
    {
        return 'ics';
    }

    public function download(Itinerary $itinerary): Response
    {
        $this->ensureNotEmpty($itinerary);

        if ($itinerary->start_date === null) {
            throw ValidationException::withMessages([
                'start_date' => 'Set a start date before exporting to a calendar.',
            ]);
        }

        $timezone = $this->timezone();

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Lakbai//Itinerary//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:'.$this->escape($itinerary->title),
            'X-WR-TIMEZONE:'.$timezone,
        ];

        $lines = array_merge($lines, $this->vtimezone($timezone));

        foreach ($this->orderedItems($itinerary) as $item) {
            $lines = array_merge($lines, $this->eventLines($itinerary, $item, $timezone));
        }

        $lines[] = 'END:VCALENDAR';

        $body = $this->fold($lines)."\r\n";

        return response($body, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$this->filename($itinerary).'.ics"',
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function eventLines(Itinerary $itinerary, ItineraryItem $item, string $timezone): array
    {
        $day = $this->dateForDay($itinerary, $item->day_number);
        $day ??= $itinerary->start_date->copy();

        $uid = 'lakbai-stop-'.$item->id.'@lakbai.app';
        $summary = $item->resolvedTitle();
        $description = $this->description($item);

        $lines = [
            'BEGIN:VEVENT',
            'UID:'.$uid,
            'DTSTAMP:'.Carbon::now()->utc()->format('Ymd\THis\Z'),
            'SUMMARY:'.$this->escape($summary),
        ];

        if ($item->start_time !== null) {
            $start = $this->combineDateTime($day, (string) $item->start_time);
            $minutes = $item->duration_minutes ?? 60;
            $end = $start->copy()->addMinutes($minutes);

            $lines[] = 'DTSTART;TZID='.$timezone.':'.$start->format('Ymd\THis');
            $lines[] = 'DTEND;TZID='.$timezone.':'.$end->format('Ymd\THis');
        } else {
            $endDay = $day->copy()->addDay();
            $lines[] = 'DTSTART;VALUE=DATE:'.$day->format('Ymd');
            $lines[] = 'DTEND;VALUE=DATE:'.$endDay->format('Ymd');
        }

        $lines[] = 'LOCATION:'.$this->escape($this->locationLine($item));

        $coords = $item->resolvedCoordinates();
        if ($coords !== null) {
            $lines[] = 'GEO:'.$coords[0].';'.$coords[1];
        }

        if ($description !== '') {
            $lines[] = 'DESCRIPTION:'.$this->escape($description);
        }

        $lines[] = 'END:VEVENT';

        return $lines;
    }

    private function description(ItineraryItem $item): string
    {
        $parts = [];

        if ($item->notes) {
            $parts[] = $item->notes;
        }

        if ($item->budgetVisible && $item->estimated_budget !== null) {
            $parts[] = 'Budget: PHP '.$item->estimated_budget;
        }

        if ($item->category) {
            $parts[] = 'Category: '.$item->category;
        }

        return implode("\n", $parts);
    }

    private function combineDateTime(Carbon $day, string $time): Carbon
    {
        [$hour, $minute] = array_pad(explode(':', $time), 2, '0');

        return $day->copy()->setTime((int) $hour, (int) $minute);
    }

    private function timezone(): string
    {
        return (string) config('lakbai.export.timezone', 'Asia/Manila');
    }

    /**
     * A minimal VTIMEZONE for Asia/Manila (fixed UTC+8, no DST).
     *
     * @return array<int, string>
     */
    private function vtimezone(string $timezone): array
    {
        if ($timezone !== 'Asia/Manila') {
            return [];
        }

        return [
            'BEGIN:VTIMEZONE',
            'TZID:Asia/Manila',
            'BEGIN:STANDARD',
            'DTSTART:19700101T000000',
            'TZOFFSETFROM:+0800',
            'TZOFFSETTO:+0800',
            'TZNAME:PHT',
            'END:STANDARD',
            'END:VTIMEZONE',
        ];
    }

    /**
     * Escape a value per RFC 5545 (backslash, semicolon, comma, newlines).
     */
    private function escape(string $value): string
    {
        $value = str_replace('\\', '\\\\', $value);
        $value = str_replace(["\r\n", "\r", "\n"], '\\n', $value);
        $value = str_replace(';', '\\;', $value);
        $value = str_replace(',', '\\,', $value);

        return $value;
    }

    /**
     * Fold lines to a maximum of 75 octets, continuing with a leading space.
     *
     * @param  array<int, string>  $lines
     */
    private function fold(array $lines): string
    {
        $folded = [];

        foreach ($lines as $line) {
            $folded[] = $this->foldLine($line);
        }

        return implode("\r\n", $folded);
    }

    private function foldLine(string $line): string
    {
        if (strlen($line) <= 75) {
            return $line;
        }

        $result = '';
        $offset = 0;
        $length = strlen($line);

        while ($offset < $length) {
            $chunkSize = ($offset === 0) ? 75 : 74;
            $chunk = substr($line, $offset, $chunkSize);
            $result .= ($offset === 0) ? $chunk : "\r\n ".$chunk;
            $offset += $chunkSize;
        }

        return $result;
    }
}
