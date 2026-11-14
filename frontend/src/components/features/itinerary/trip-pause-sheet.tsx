import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

interface TripPauseSheetProps {
  open: boolean;
  remainingCount: number;
  maxDay: number;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onShift: (minutes: number) => void;
  onMoveDay: (day: number) => void;
  onFinish: () => void;
}

export function TripPauseSheet({
  open,
  remainingCount,
  maxDay,
  busy = false,
  error,
  onClose,
  onShift,
  onMoveDay,
  onFinish,
}: TripPauseSheetProps) {
  const [customMinutes, setCustomMinutes] = useState("45");
  const [day, setDay] = useState(1);

  useEffect(() => {
    if (!open) return;
    // Re-seed the quick-shift controls each time the sheet opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomMinutes("45");
    setDay(Math.max(1, Math.min(maxDay, 1)));
  }, [open, maxDay]);

  const parsedCustom = Number(customMinutes);
  const customValid = Number.isFinite(parsedCustom) && parsedCustom > 0 && parsedCustom <= 1440;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Trip paused"
      description="Your location is no longer being shared."
      size="sm"
      busy={busy}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Resume later
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-sand-50 px-3 py-2.5 text-sm text-ink-700">
          <p className="font-semibold text-lagoon-900">{remainingCount} stops left</p>
          <p className="mt-0.5 text-xs text-ink-600">
            Adjust the rest of the day, move it to another day, or finish the trip here.
          </p>
        </div>

        {remainingCount === 0 ? (
          <p className="rounded-xl bg-sea-500/5 px-3 py-2 text-xs text-ink-700 ring-1 ring-inset ring-sea-500/15">
            Every stop is handled. Finish the trip whenever you are ready.
          </p>
        ) : (
          <>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Shift remaining stops</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onShift(30)} disabled={busy}>
                  +30 min
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onShift(60)} disabled={busy}>
                  +1 hour
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  aria-label="Custom shift in minutes"
                  className="h-9 w-24"
                />
                <span className="text-xs text-ink-600">minutes</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onShift(Math.round(parsedCustom))}
                  disabled={busy || !customValid}
                >
                  Shift
                </Button>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Move to another day</h3>
              <div className="mt-1.5 flex items-center gap-1.5">
                <select
                  value={day}
                  onChange={(event) => setDay(Number(event.target.value))}
                  aria-label="Destination day"
                  className="h-9 rounded-xl border border-line bg-white px-2.5 text-sm text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-surf-400"
                >
                  {Array.from({ length: Math.max(maxDay, 1) }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      Day {value}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={() => onMoveDay(day)} disabled={busy}>
                  Move stops
                </Button>
              </div>
            </section>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onFinish}
          disabled={busy}
          className={cn(
            "w-full rounded-full px-3 py-2 text-sm font-semibold transition-colors",
            "text-sinulog-red ring-1 ring-inset ring-sinulog-red/20 hover:bg-sinulog-red/5 disabled:opacity-50",
          )}
        >
          Finish trip now
        </button>
      </div>
    </Modal>
  );
}
