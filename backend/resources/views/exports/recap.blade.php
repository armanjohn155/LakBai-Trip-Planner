<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $recap['title'] }}</title>
    <style>
        @page {
            size: A4;
            margin: 24mm 16mm 20mm 16mm;
        }

        * { box-sizing: border-box; }

        body {
            font-family: "DejaVu Sans", sans-serif;
            color: #12232b;
            font-size: 11px;
            line-height: 1.5;
        }

        .cover {
            border-bottom: 2px solid #14b8a6;
            padding-bottom: 14px;
            margin-bottom: 16px;
        }

        .brand {
            font-size: 10px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #0f766e;
            margin-bottom: 6px;
        }

        h1 { font-size: 24px; margin: 0 0 6px; color: #0b3a3a; }
        h2 { font-size: 14px; margin: 18px 0 8px; color: #0b3a3a; }
        .muted { color: #4b5b66; }
        .summary { margin-top: 8px; color: #33454f; }

        table.stats {
            width: 100%;
            border-collapse: collapse;
            margin: 0 0 12px;
            background: #f1f7f6;
        }

        table.stats td {
            width: 33.33%;
            padding: 8px 10px;
            border: 1px solid #cfe9e5;
        }

        .stat-value { font-size: 15px; font-weight: bold; color: #0b3a3a; }
        .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #4b5b66; }

        .day { margin-bottom: 14px; page-break-inside: avoid; }
        .day-header {
            background: #0f766e;
            color: #fff;
            padding: 5px 9px;
            font-weight: bold;
            border-radius: 5px 5px 0 0;
        }

        table.stops { width: 100%; border-collapse: collapse; }
        table.stops th {
            background: #e9f2f1;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: .5px;
            padding: 5px 8px;
            border-bottom: 1px solid #cfe9e5;
        }
        table.stops td { padding: 6px 8px; border-bottom: 1px solid #e6edf0; vertical-align: top; }
        .stop-title { font-weight: bold; color: #0b3a3a; }
        .badge { font-size: 8px; color: #0f766e; }
        .skipped { color: #9a3412; font-size: 9px; }

        .footer { margin-top: 22px; font-size: 9px; color: #6b7a86; }
    </style>
</head>
<body>
    <div class="cover">
        <div class="brand">Lakbai · Trip recap</div>
        <h1>{{ $recap['title'] }}</h1>
        <div class="muted">
            @if ($recap['start_date'])
                {{ \Illuminate\Support\Carbon::parse($recap['start_date'])->format('M j, Y') }}
                @if ($recap['end_date'] && $recap['end_date'] !== $recap['start_date'])
                    – {{ \Illuminate\Support\Carbon::parse($recap['end_date'])->format('M j, Y') }}
                @endif
            @else
                Dates not recorded
            @endif
            · {{ $recap['day_count'] }} {{ \Illuminate\Support\Str::plural('day', $recap['day_count']) }}
        </div>
        @if ($recap['summary'])
            <div class="summary">{{ $recap['summary'] }}</div>
        @endif
    </div>

    @if ($recap['stats'])
        @php($stats = $recap['stats'])
        <table class="stats">
            <tr>
                <td>
                    <div class="stat-value">{{ number_format(((int) $stats['distance_m']) / 1000, 1) }} km</div>
                    <div class="stat-label">Distance</div>
                </td>
                <td>
                    <div class="stat-value">{{ intdiv((int) $stats['moving_seconds'], 3600) }}h {{ intdiv((int) $stats['moving_seconds'] % 3600, 60) }}m</div>
                    <div class="stat-label">Moving time</div>
                </td>
                <td>
                    <div class="stat-value">{{ $stats['stops_visited'] }} / {{ $stats['stops_total'] }}</div>
                    <div class="stat-label">Stops visited</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="stat-value">{{ $stats['verified_visits'] }}</div>
                    <div class="stat-label">Verified visits</div>
                </td>
                <td>
                    <div class="stat-value">{{ $stats['average_speed_kmh'] }} km/h</div>
                    <div class="stat-label">Average speed</div>
                </td>
                <td>
                    <div class="stat-value">{{ $stats['stops_skipped'] }}</div>
                    <div class="stat-label">Stops skipped</div>
                </td>
            </tr>
            @if ($stats['spend_estimated'] !== null)
                <tr>
                    <td colspan="3">
                        <div class="stat-value">&#8369;{{ number_format((float) $stats['spend_estimated'], 2) }}</div>
                        <div class="stat-label">Estimated spend (planned: &#8369;{{ number_format((float) $stats['spend_planned'], 2) }})</div>
                    </td>
                </tr>
            @endif
        </table>
    @endif

    <h2>Stops</h2>

    @foreach (collect($recap['stops'])->groupBy('day_number') as $day => $stops)
        <div class="day">
            <div class="day-header">Day {{ $day }}</div>
            <table class="stops">
                <thead>
                    <tr>
                        <th style="width: 12%;">Time</th>
                        <th style="width: 50%;">Stop</th>
                        <th style="width: 22%;">Category</th>
                        <th style="width: 16%;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($stops as $stop)
                        <tr>
                            <td>{{ $stop['start_time'] ? \Illuminate\Support\Str::of($stop['start_time'])->substr(0, 5) : '—' }}</td>
                            <td>
                                <div class="stop-title">{{ $stop['title'] }}</div>
                                @if ($stop['municipality'])
                                    <div class="muted">{{ $stop['municipality'] }}</div>
                                @endif
                                @if ($stop['verified'])
                                    <div class="badge">Verified visit</div>
                                @endif
                            </td>
                            <td>{{ $stop['category'] ?: '—' }}</td>
                            <td>
                                {{ $stop['status'] === 'done' ? 'Visited' : ($stop['status'] === 'skipped' ? 'Skipped' : ucfirst($stop['status'])) }}
                                @if ($stop['status'] === 'skipped')
                                    <div class="skipped">Not visited</div>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endforeach

    <div class="footer">
        Generated by Lakbai. Route and statistics come from the trip tracker; budget figures are estimates.
    </div>
</body>
</html>
