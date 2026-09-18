/* eslint-disable react-refresh/only-export-components */

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Itinerary } from "@/lib/types";

const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

export const TRIP_PLACEHOLDER_IMAGE = "/images/trip-placeholder.svg";

type TripStatus = "upcoming" | "in-progress" | "past";

const statusClasses: Record<TripStatus, string> = {
  upcoming: "bg-surf-400/90 text-royal-950",
  "in-progress": "bg-mango-400/90 text-lagoon-900",
  past: "bg-sand-200/90 text-ink-600",
};

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function tripStatus(itinerary: Itinerary): TripStatus | null {
  const today = localDateString(new Date());
  const start = itinerary.start_date;
  const end = itinerary.end_date;

  if (end && end < today) return "past";
  if (start && start > today) return "upcoming";
  if (start) return "in-progress";
  if (end) return "upcoming";
  return null;
}

const statusLabel: Record<TripStatus, string> = {
  upcoming: "Upcoming",
  "in-progress": "In progress",
  past: "Past",
};

interface TripCardProps {
  itinerary: Itinerary;
  onOpen: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  duplicateBusy?: boolean;
}

export function TripCard({ itinerary, onOpen, onDelete, onDuplicate, duplicateBusy }: TripCardProps) {
  const [errored, setErrored] = useState(false);
  const coverUrl = itinerary.items?.map((item) => item.destination?.image_url).find(Boolean) ?? TRIP_PLACEHOLDER_IMAGE;
  const status = tripStatus(itinerary);

  const range = itinerary.start_date && itinerary.end_date
    ? `${dayFormat.format(new Date(itinerary.start_date))} – ${dayFormat.format(new Date(itinerary.end_date))}`
    : "Dates not set";

  return (
    <Card className="glass-frost flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-sand-100">
        {errored ? null : (
          <img src={coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setErrored(true)} />
        )}
        {status ? (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm",
              statusClasses[status],
            )}
          >
            {statusLabel[status]}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="font-display text-xl font-semibold text-lagoon-900">{itinerary.title}</h3>
          <p className="mt-0.5 text-sm text-ink-600">{range}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral" className="bg-white/20 text-ink-700 ring-1 ring-inset ring-white/30 backdrop-blur-md">
            {itinerary.item_count ?? 0} stops
          </Badge>
          <Badge tone="mango" className="bg-mango-400/20 ring-1 ring-inset ring-mango-400/30 backdrop-blur-md">
            {formatMoney(itinerary.total_budget)}
          </Badge>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Button className="flex-1" onClick={onOpen}>
            Open planner
          </Button>
          {onDuplicate ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDuplicate}
              disabled={duplicateBusy}
              aria-label={`Duplicate ${itinerary.title}`}
            >
              <CopyIcon />
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="danger" size="sm" onClick={onDelete} aria-label={`Delete ${itinerary.title}`}>
              <DeleteIcon />
            </Button>
          ) : null}
        </div>
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