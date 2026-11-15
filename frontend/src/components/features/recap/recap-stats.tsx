import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import type { RecapAccent, RecapStats } from "@/lib/types";

import { accentTheme, formatDuration } from "./recap-utils";

interface RecapStatsStripProps {
  stats: RecapStats | null;
  accent?: RecapAccent;
  className?: string;
}

/**
 * The "story in numbers" strip. Every value is optional because public
 * payloads drop budget fields and older recaps may predate a counter.
 */
export function RecapStatsStrip({ stats, accent, className }: RecapStatsStripProps) {
  if (!stats) return null;

  const theme = accentTheme(accent);
  const distance = formatDistance(stats.distance_m);
  const travelled = formatDuration(stats.elapsed_seconds ?? stats.moving_seconds);
  const visited = stats.stops_visited ?? 0;
  const total = stats.stops_total ?? visited;
  const hasSpend = stats.spend_estimated !== null && stats.spend_estimated !== undefined;

  const cells: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Distance", value: distance ?? "0 m", hint: stats.average_speed_kmh ? `${stats.average_speed_kmh} km/h average` : undefined },
    { label: "Time on the road", value: travelled, hint: stats.moving_seconds ? `${formatDuration(stats.moving_seconds)} moving` : undefined },
    { label: "Stops visited", value: `${visited} / ${total}`, hint: stats.stops_skipped ? `${stats.stops_skipped} skipped` : "Every stop handled" },
    { label: "Days", value: String(stats.days ?? 1), hint: stats.travellers ? `${stats.travellers} ${stats.travellers === 1 ? "traveller" : "travellers"}` : undefined },
  ];

  if (stats.verified_visits !== null && stats.verified_visits !== undefined) {
    cells.push({
      label: "Verified check-ins",
      value: String(stats.verified_visits),
      hint: "GPS-confirmed on the ground",
    });
  }

  if (hasSpend) {
    cells.push({
      label: "Trip spend",
      value: formatMoney(stats.spend_estimated),
      hint: stats.spend_planned ? `${formatMoney(stats.spend_planned)} planned` : undefined,
    });
  }

  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {cells.map((cell) => (
        <div key={cell.label} className={cn("rounded-2xl bg-white/75 p-4 ring-1 ring-inset ring-line/60 backdrop-blur-sm")}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{cell.label}</dt>
          <dd className={cn("mt-1 font-display text-xl font-semibold text-lagoon-900", theme.text)}>{cell.value}</dd>
          {cell.hint ? (
            <p className="mt-0.5 truncate text-[11px] text-ink-600" title={cell.hint}>
              {cell.hint}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
