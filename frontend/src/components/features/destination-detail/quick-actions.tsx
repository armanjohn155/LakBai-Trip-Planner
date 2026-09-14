import { CebuMap } from "@/components/features/map/cebu-map";
import { getDestinationFacts } from "@/components/features/destination-detail/destination-facts";
import { DownloadIcon, HeartIcon, MapIcon, PinIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { toNumber } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface QuickActionsProps {
  destination: Destination;
  favorited: boolean;
  onToggleFavorite: () => void;
  onAddToTrip: () => void;
  onViewOnMap: () => void;
}

const BUTTON_CLASS = "h-11 w-full";

export function QuickActions({ destination, favorited, onToggleFavorite, onAddToTrip, onViewOnMap }: QuickActionsProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-lagoon-900">Quick Actions</h2>
        <PinIcon className="h-4 w-4 text-surf-400" />
      </div>

      <div className="mt-4 space-y-2.5">
        <Button size="md" className={BUTTON_CLASS} onClick={onAddToTrip}>
          <PlusIcon className="h-4 w-4" />
          Add to My Trip
        </Button>
        <Button size="md" variant="secondary" className={BUTTON_CLASS} onClick={onToggleFavorite}>
          <HeartIcon filled={favorited} className={cn("h-4 w-4", favorited ? "text-mango-400" : "text-sea-500")} />
          {favorited ? "Saved to Favorites" : "Save to Favorites"}
        </Button>
        <Button size="md" variant="dark" className={BUTTON_CLASS} onClick={() => downloadInfo(destination)}>
          <DownloadIcon className="h-4 w-4" />
          Download Info
        </Button>
        <Button size="md" variant="dark" className={BUTTON_CLASS} onClick={onViewOnMap}>
          <MapIcon className="h-4 w-4" />
          View on Map
        </Button>
      </div>

      <div className="my-5 h-px bg-line" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">Location</p>
        <div className="mt-2 h-40 overflow-hidden rounded-xl ring-1 ring-line">
          <CebuMap destinations={[destination]} activeId={destination.id} interactive={false} className="h-full w-full" />
        </div>
        <p className="mt-2.5 font-mono text-xs text-ink-600">
          {Number(toNumber(destination.latitude)).toFixed(4)}, {Number(toNumber(destination.longitude)).toFixed(4)}
        </p>
        <p className="mt-0.5 text-sm font-medium text-lagoon-900">{destinationLocationAddress(destination)}</p>
      </div>
    </Card>
  );
}

function destinationLocationAddress(destination: Destination): string {
  const place = destination.municipality ?? destination.region;
  return place === "Cebu City" || place === "Lapu-Lapu City" ? place : `${place}, Cebu`;
}

function downloadInfo(destination: Destination): void {
  const facts = getDestinationFacts(destination);
  const place = destination.municipality ?? destination.region;
  const lines = [
    destination.name.toUpperCase(),
    `${destination.category} · ${place}, ${destination.region}`,
    `Rating ${destination.rating ?? "—"} (${destination.review_count ?? 0} reviews) · Budget ~ ₱${destination.estimated_cost ?? "—"}`,
    "",
    `ABOUT`,
    destination.description,
    "",
    `AT A GLANCE`,
    `Entrance fee: ${facts.entrance_fee}`,
    `Visit duration: ${facts.visit_duration}`,
    `Opening hours: ${facts.opening_hours}`,
    `Best time to visit: ${destination.best_time_to_visit ?? "—"}`,
    "",
    `ACTIVITIES`,
    ...facts.activities,
    "",
    `HOW TO GET THERE`,
    ...facts.transport.map((option) => `• ${option.mode} — ${option.origin} (${option.price}, ${option.duration})`),
    "",
    `TRAVEL TIPS`,
    ...facts.extra_tips.map((tip, index) => `${index + 1}. ${tip}`),
    "",
    `Location: ${Number(toNumber(destination.latitude)).toFixed(4)}, ${Number(toNumber(destination.longitude)).toFixed(4)}`,
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${destination.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-info.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}