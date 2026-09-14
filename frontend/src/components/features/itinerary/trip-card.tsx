import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Itinerary } from "@/lib/types";

const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

interface TripCardProps {
  itinerary: Itinerary;
  onOpen: () => void;
  onDelete?: () => void;
}

export function TripCard({ itinerary, onOpen, onDelete }: TripCardProps) {
  const range = itinerary.start_date && itinerary.end_date
    ? `${dayFormat.format(new Date(itinerary.start_date))} – ${dayFormat.format(new Date(itinerary.end_date))}`
    : "Dates not set";

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-display text-xl font-semibold text-lagoon-900">{itinerary.title}</h3>
        <p className="mt-0.5 text-sm text-ink-600">{range}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{itinerary.item_count ?? 0} stops</Badge>
        <Badge tone="mango">{formatMoney(itinerary.total_budget)}</Badge>
      </div>

      <div className={cn("mt-auto flex items-center gap-2")}>
        <Button className="flex-1" onClick={onOpen}>
          Open planner
        </Button>
        {onDelete ? (
          <Button variant="danger" size="sm" onClick={onDelete} aria-label={`Delete ${itinerary.title}`}>
            <DeleteIcon />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}