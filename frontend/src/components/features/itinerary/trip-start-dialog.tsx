import { ShieldIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatTripDateRange } from "@/components/features/itinerary/itinerary-constants";
import type { Itinerary } from "@/lib/types";

interface TripStartDialogProps {
  open: boolean;
  itinerary: Itinerary;
  stopCount: number;
  busy?: boolean;
  error?: string | null;
  locating?: boolean;
  locationError?: string | null;
  onStartWithoutLocation?: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function TripStartDialog({ open, itinerary, stopCount, busy = false, error, locating = false, locationError, onStartWithoutLocation, onClose, onConfirm }: TripStartDialogProps) {
  const dateRange = formatTripDateRange(itinerary.start_date, itinerary.end_date);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start this trip?"
      description="Live tracking begins when you start. You can pause at any time."
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Not yet
          </Button>
          <Button onClick={onConfirm} disabled={busy || stopCount === 0}>
            {locating ? "Finding your location..." : busy ? "Starting..." : locationError ? "Try location again" : "Start trip"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-sand-50 p-3 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Trip</dt>
            <dd className="mt-0.5 font-semibold text-lagoon-900">{itinerary.title}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Stops</dt>
            <dd className="mt-0.5 font-semibold text-lagoon-900">
              {stopCount} {stopCount === 1 ? "stop" : "stops"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">When</dt>
            <dd className="mt-0.5 font-semibold text-lagoon-900">{dateRange ?? "Dates not set yet"}</dd>
          </div>
        </dl>

        <div className="flex gap-2 rounded-xl bg-sea-500/5 px-3 py-2.5 text-xs text-ink-700 ring-1 ring-inset ring-sea-500/15">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-sea-600" />
          <p>
            Your location is used on this screen while the trip is active. Active trip points are saved to your private trip record
            and stop uploading when you pause or finish. Keep this screen on; browsers may pause location when the screen locks.
          </p>
        </div>

        {locationError ? (
          <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
            <p>{locationError}</p>
            <p>If permission was denied, allow location for this site in your browser settings. You can still start without it.</p>
            {onStartWithoutLocation ? (
              <Button size="sm" variant="secondary" onClick={onStartWithoutLocation} disabled={busy}>
                Start without location
              </Button>
            ) : null}
          </div>
        ) : null}

        {stopCount === 0 ? (
          <p className="rounded-xl bg-mango-400/15 px-3 py-2 text-xs text-ink-800">
            Add at least one stop before starting the trip.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
