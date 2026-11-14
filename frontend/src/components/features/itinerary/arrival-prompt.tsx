import { Link } from "react-router";

import { CheckIcon, PinIcon, ShieldIcon, StarIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";
import type { ItineraryItem } from "@/lib/types";

interface TripArrivalPromptProps {
  item: ItineraryItem;
  distanceM: number | null;
  busy?: boolean;
  error?: string | null;
  onMarkVisited: () => void;
  onNotYet: () => void;
  onSkip: () => void;
}

/**
 * Non-blocking arrival card. It never blocks the map, and every action can be
 * dismissed so a traveller can keep walking without losing the prompt forever.
 */
export function TripArrivalPrompt({
  item,
  distanceM,
  busy = false,
  error,
  onMarkVisited,
  onNotYet,
  onSkip,
}: TripArrivalPromptProps) {
  const distance = formatDistance(distanceM);

  return (
    <div
      className="pointer-events-auto w-[min(94vw,26rem)] rounded-2xl bg-white/97 p-3.5 shadow-2xl ring-1 ring-line/60 backdrop-blur trip-arrival-card"
      role="alertdialog"
      aria-label={`You have arrived at ${item.title}`}
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surf-400/15 text-sea-600">
          <PinIcon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-lagoon-900">
            You&apos;ve arrived at {item.title}
            {item.verified ? (
              <Badge tone="surf" className="gap-1">
                <CheckIcon className="h-3 w-3" /> Verified
              </Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-ink-600">
            {distance ? `About ${distance} from the stop. ` : ""}
            Mark it visited when you are ready.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={onMarkVisited} disabled={busy}>
          {busy ? "Checking..." : "Mark visited"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onNotYet} disabled={busy}>
          Not yet
        </Button>
        <Button size="sm" variant="danger" onClick={onSkip} disabled={busy}>
          Skip stop
        </Button>
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-ink-500">
        <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0 text-sea-500" />
        <p>Your position is checked on the server before this stop is marked visited.</p>
      </div>

      {error ? (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TripReviewCardProps {
  destinationId: number;
  destinationName: string;
  className?: string;
  onDismiss: () => void;
}

/**
 * Optional, non-blocking follow-up. It never interrupts the trip flow and has
 * no form of its own; the destination page owns the review experience.
 */
export function TripReviewCard({ destinationId, destinationName, className, onDismiss }: TripReviewCardProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-[min(92vw,22rem)] items-start gap-2 rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-line/60 backdrop-blur trip-summary-card",
        className,
      )}
      role="status"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mango-400/20 text-lagoon-900">
        <StarIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-lagoon-900">Visited {destinationName}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-600">Share a quick review when you have a moment.</p>
        <Link
          to={`/destinations/${destinationId}`}
          className="mt-1.5 inline-flex rounded-full bg-surf-400 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-surf-300"
        >
          Write a review
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss review suggestion"
        className="rounded-lg p-1 text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
