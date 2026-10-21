/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";

import { CameraIcon, CalendarIcon, CheckIcon, MapIcon, PinIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";
import { apiError, checkIn, recordManualVisit } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Destination, Visit, VisitStatus } from "@/lib/types";

interface CheckInPanelProps {
  destination: Destination;
  status: VisitStatus;
  onStatusChange: (visit: Visit) => void;
}

const STATUS_COPY: Record<VisitStatus, { label: string; tone: "sea" | "mango" | "neutral"; detail: string }> = {
  verified: {
    label: "Verified visit",
    tone: "sea",
    detail: "Your GPS confirmed you were here. You can write a review and this counts toward your history.",
  },
  manual: {
    label: "Marked as visited",
    tone: "mango",
    detail: "You marked this yourself. It shows in your history, but it isn't GPS-verified — so reviews stay locked until you check in on site.",
  },
  none: {
    label: "Not visited yet",
    tone: "neutral",
    detail: "Check in when you're actually at the place. We verify your location on the server — we never track you afterwards.",
  },
};

/**
 * Honest, server-verified check-in. The GPS path is the only way to earn a
 * "verified" visit; the manual path is clearly labelled as unverified.
 */
export function CheckInPanel({ destination, status, onStatusChange }: CheckInPanelProps) {
  const { getPosition, supported } = useGeolocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const copy = STATUS_COPY[status];

  const handleCheckIn = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const position = await getPosition();
      const visit = await checkIn(destination.id, {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
      });
      onStatusChange(visit);
      setMessage("Check-in verified. Salamat, Bai!");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={copy.tone}>{copy.label}</Badge>
        {status === "verified" ? <CheckIcon className="h-4 w-4 text-sea-600" /> : null}
      </div>

      <p className="text-[13px] leading-relaxed text-ink-600">{copy.detail}</p>

      {error ? <InlineError message={error} /> : null}
      {message ? (
        <p className="rounded-xl bg-sea-500/10 px-3.5 py-2.5 text-sm font-medium text-sea-600" role="status">
          {message}
        </p>
      ) : null}

      <div className="space-y-2.5">
        <Button size="md" className="h-11 w-full" onClick={() => void handleCheckIn()} disabled={busy || !supported}>
          {busy ? <Spinner className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
          {busy ? "Verifying…" : status === "verified" ? "Check in again" : "Check in with GPS"}
        </Button>

        <Button
          size="md"
          variant="secondary"
          className="h-11 w-full"
          onClick={() => setShowManual(true)}
          disabled={busy}
        >
          <CalendarIcon className="h-4 w-4" />
          I visited before — add manually
        </Button>
      </div>

      {!supported ? (
        <p className="text-xs text-ink-600">Your browser doesn't support location sharing, so only manual visits are available here.</p>
      ) : null}

      <p className="flex items-start gap-1.5 text-xs text-ink-600">
        <MapIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        We store only the coordinates of your check-in to verify distance. No continuous tracking.
      </p>

      {showManual ? (
        <ManualVisitModal
          destination={destination}
          onClose={() => setShowManual(false)}
          onSaved={(visit) => {
            setShowManual(false);
            onStatusChange(visit);
            setMessage("Added to your history as an unverified visit.");
          }}
        />
      ) : null}
    </div>
  );
}

interface ManualVisitModalProps {
  destination: Destination;
  onClose: () => void;
  onSaved: (visit: Visit) => void;
}

function ManualVisitModal({ destination, onClose, onSaved }: ManualVisitModalProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const visit = await recordManualVisit(destination.id, {
        visited_at: date,
        notes: notes.trim() || null,
      });
      onSaved(visit);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl glass p-5">
        <h2 className="font-display text-xl font-semibold text-lagoon-900">Add a past visit</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          This is an honest record, not a GPS-verified check-in. Reviews stay locked until you check in on site.
        </p>

        <div className="mt-4 space-y-3">
          {error ? <InlineError message={error} /> : null}

          <Input
            type="date"
            label="Date visited"
            name="visited_at"
            max={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-900">Notes (optional)</span>
            <textarea
              className="min-h-20 w-full rounded-xl bg-white/70 px-4 py-3 text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400 backdrop-blur-sm"
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Who you went with, what you did…"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !date}>
            {busy ? <Spinner className="h-4 w-4" /> : <CameraIcon className="h-4 w-4" />}
            Add visit
          </Button>
        </div>
      </div>
    </div>
  );
}

export const visitStatusBadgeTone = (status: VisitStatus): "sea" | "mango" | "neutral" => STATUS_COPY[status].tone;

export function VisitStatusPill({ status, className }: { status: VisitStatus; className?: string }) {
  if (status === "none") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        status === "verified" ? "bg-sea-500/10 text-sea-600" : "bg-mango-400/20 text-lagoon-900",
        className,
      )}
    >
      <CheckIcon className="h-3 w-3" />
      {status === "verified" ? "Visited" : "Marked visited"}
    </span>
  );
}
