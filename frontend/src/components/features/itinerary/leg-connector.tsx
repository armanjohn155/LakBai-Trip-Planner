import { CarIcon } from "@/components/icons";
import { approximateDriveMinutes, formatDistance, haversineMeters } from "@/lib/geo";
import { cn } from "@/lib/cn";
import type { ItineraryItem, ItineraryRouteLeg } from "@/lib/types";

interface LegConnectorProps {
  from: ItineraryItem;
  to: ItineraryItem;
  leg?: ItineraryRouteLeg;
  estimatesEnabled: boolean;
  loading?: boolean;
}

export function LegConnector({ from, to, leg, estimatesEnabled, loading = false }: LegConnectorProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-14" aria-hidden="true">
        <span className="h-6 w-6 animate-pulse rounded-full bg-sand-100" />
        <span className="h-3 w-28 animate-pulse rounded-full bg-sand-100" />
      </div>
    );
  }

  const straightLine = haversineMeters(from, to);
  const hasEstimate = estimatesEnabled && leg?.duration_s != null;
  const distance = hasEstimate ? leg.distance_m : straightLine;
  const minutes = hasEstimate ? Math.max(1, Math.round((leg.duration_s ?? 0) / 60)) : approximateDriveMinutes(straightLine);
  const approximate = !hasEstimate || leg?.source === "haversine";

  if (distance === null && minutes === null) return null;

  const distanceLabel = formatDistance(distance);

  return (
    <div className={cn("flex items-center gap-2 py-1.5 pl-14 text-[11px] leading-tight text-ink-500")}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand-100 text-ink-600">
        <CarIcon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        {distanceLabel ? <span className="font-semibold text-ink-600">{distanceLabel}</span> : null}
        {distanceLabel && minutes !== null ? " · " : null}
        {minutes !== null ? `~${minutes} min drive` : null}
        {approximate ? <span className="ml-1 text-ink-500">approx.</span> : null}
      </span>
    </div>
  );
}
