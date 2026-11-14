import { CheckIcon, RouteIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";
import type { Itinerary, ItineraryItem } from "@/lib/types";

interface TripFinishDialogProps {
  open: boolean;
  remaining: ItineraryItem[];
  visitedCount: number;
  totalStops: number;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function stopLabel(item: ItineraryItem): string {
  return item.title;
}

export function TripFinishDialog({
  open,
  remaining,
  visitedCount,
  totalStops,
  busy = false,
  error,
  onClose,
  onConfirm,
}: TripFinishDialogProps) {
  const early = remaining.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={early ? "Finish this trip early?" : "Finish this trip?"}
      description={
        early
          ? "Stops you have not visited will be marked as skipped. Tracking stops as soon as you finish."
          : "Every stop is handled. Finishing stops location sharing and keeps your route summary."
      }
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep going
          </Button>
          <Button variant={early ? "dark" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Finishing..." : early ? "Finish early" : "Finish trip"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-sand-50 p-3 text-center">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Visited</dt>
            <dd className="mt-0.5 text-lg font-semibold text-lagoon-900">{visitedCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">To skip</dt>
            <dd className="mt-0.5 text-lg font-semibold text-lagoon-900">{remaining.length}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Total</dt>
            <dd className="mt-0.5 text-lg font-semibold text-lagoon-900">{totalStops}</dd>
          </div>
        </dl>

        {early ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">These stops will be skipped</h3>
            <ul className="mt-1.5 max-h-56 space-y-1 overflow-y-auto pr-1">
              {remaining.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm text-ink-800 ring-1 ring-line/60"
                >
                  <span className="min-w-0 truncate">{stopLabel(item)}</span>
                  <span className="shrink-0 text-[11px] text-ink-500">Day {item.day_number}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-sea-500/5 px-3 py-2.5 text-xs text-ink-700 ring-1 ring-inset ring-sea-500/15">
            <CheckIcon className="h-4 w-4 shrink-0 text-sea-600" />
            <p>You reached every planned stop. Nice work.</p>
          </div>
        )}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

interface TripSummaryCardProps {
  itinerary: Itinerary;
  visitedCount: number;
  skippedCount: number;
  elapsedSeconds: number;
  className?: string;
  onDismiss: () => void;
}

function formatElapsedLong(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function TripSummaryCard({
  itinerary,
  visitedCount,
  skippedCount,
  elapsedSeconds,
  className,
  onDismiss,
}: TripSummaryCardProps) {
  const distance = formatDistance(itinerary.distance_m ?? 0);

  return (
    <div
      className={cn(
        "pointer-events-auto w-[min(92vw,24rem)] rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-line/60 backdrop-blur trip-summary-card",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sea-600">Trip complete</p>
          <p className="mt-0.5 font-display text-base font-semibold text-lagoon-900">{itinerary.title}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss trip summary"
          className="rounded-lg p-1 text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-sand-50 px-2 py-1.5">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            <RouteIcon className="h-3 w-3" /> Distance
          </p>
          <p className="mt-0.5 text-sm font-semibold text-lagoon-900">{distance ?? "0 m"}</p>
        </div>
        <div className="rounded-xl bg-sand-50 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Time</p>
          <p className="mt-0.5 text-sm font-semibold text-lagoon-900">{formatElapsedLong(elapsedSeconds)}</p>
        </div>
        <div className="rounded-xl bg-sand-50 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Visited</p>
          <p className="mt-0.5 text-sm font-semibold text-lagoon-900">{visitedCount}</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-ink-600">
        {skippedCount > 0
          ? `${skippedCount} ${skippedCount === 1 ? "stop was" : "stops were"} skipped.`
          : "Every planned stop was visited."}
      </p>
    </div>
  );
}
