import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, FieldHint } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/feedback";
import { CheckIcon } from "@/components/icons";
import { apiError, updateTripRecap } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { RecapAccent, TripRecap } from "@/lib/types";

import { accentTheme, resolveRecapMediaUrl } from "./recap-utils";

const ACCENTS: Array<{ value: RecapAccent; label: string }> = [
  { value: "surf", label: "Surf" },
  { value: "mango", label: "Mango" },
  { value: "sea", label: "Sea" },
  { value: "royal", label: "Royal" },
  { value: "magenta", label: "Sinulog" },
];

interface RecapDesignPanelProps {
  open: boolean;
  recap: TripRecap;
  onClose: () => void;
  onSaved: (recap: TripRecap) => void;
}

export function RecapDesignPanel({ open, recap, onClose, onSaved }: RecapDesignPanelProps) {
  if (!open) return null;
  return <RecapDesignPanelContent key={recap.id} open={open} recap={recap} onClose={onClose} onSaved={onSaved} />;
}

function RecapDesignPanelContent({ open, recap, onClose, onSaved }: RecapDesignPanelProps) {
  const [title, setTitle] = useState(recap.title);
  const [summary, setSummary] = useState(recap.summary ?? "");
  const [coverId, setCoverId] = useState<number | null>(recap.cover_photo_id);
  const [accent, setAccent] = useState<RecapAccent>(recap.theme_accent);
  const [showStats, setShowStats] = useState(recap.show_stats);
  const [showPhotos, setShowPhotos] = useState(recap.show_photos);
  const [hideEndpoints, setHideEndpoints] = useState(recap.hide_endpoints);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateTripRecap(recap.itinerary_id, {
        title: title.trim() || recap.title,
        summary: summary.trim() || null,
        cover_photo_id: showPhotos ? coverId : null,
        theme_accent: accent,
        show_stats: showStats,
        show_photos: showPhotos,
        hide_endpoints: hideEndpoints,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Design your recap"
      description="Make the memory feel like yours. You can change all of this later."
      size="lg"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Save design
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Recap title"
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Our Badian weekend"
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-ink-900">Accent colour</span>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((option) => {
                const theme = accentTheme(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccent(option.value)}
                    aria-pressed={accent === option.value}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-800 ring-1 ring-inset transition-colors",
                      accent === option.value ? "bg-sand-100 ring-lagoon-900/30" : "bg-white/60 ring-line hover:bg-sand-50",
                    )}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full", theme.bg)} aria-hidden="true" />
                    {option.label}
                    {accent === option.value ? <CheckIcon className="h-3 w-3 text-sea-600" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="recap-summary" className="block text-sm font-semibold text-ink-900">
            Summary
          </label>
          <textarea
            id="recap-summary"
            value={summary}
            rows={4}
            maxLength={1000}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="A few lines about the trip: the weather, the food, the wrong turns."
            className="w-full rounded-xl bg-white/70 px-4 py-3 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:ring-2 focus:ring-surf-400 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <FieldHint>Shown on the member and public recap.</FieldHint>
            <span className="text-[11px] text-ink-500">{summary.length}/1000</span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-semibold text-ink-900">Cover photo</span>
          {recap.photos.length === 0 ? (
            <FieldHint>Upload a photo first, then come back to pick a cover.</FieldHint>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              <button
                type="button"
                onClick={() => setCoverId(null)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border text-[11px] font-semibold",
                  coverId === null ? "border-lagoon-900 bg-lagoon-900 text-sand-50" : "border-dashed border-line text-ink-600 hover:bg-sand-50",
                )}
              >
                First photo
              </button>
              {recap.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    setCoverId(photo.id);
                    setShowPhotos(true);
                  }}
                  aria-pressed={coverId === photo.id}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl ring-2 transition-all",
                    coverId === photo.id ? "ring-lagoon-900" : "ring-transparent hover:ring-line",
                  )}
                >
                  <img
                    src={resolveRecapMediaUrl(photo.thumbnail_url) ?? undefined}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {photo.is_hidden ? (
                    <span className="absolute inset-x-0 bottom-0 bg-lagoon-950/70 py-0.5 text-[9px] font-semibold text-sand-50">
                      Hidden
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5 rounded-2xl bg-sand-50 p-4">
          <Toggle
            checked={hideEndpoints}
            onChange={setHideEndpoints}
            label="Hide the exact start and end"
            hint="Trims about 300 m from both ends of the public route."
          />
          <Toggle
            checked={showStats}
            onChange={setShowStats}
            label="Show trip stats"
            hint="Distance, time, stops and verified check-ins."
          />
          <Toggle
            checked={showPhotos}
            onChange={setShowPhotos}
            label="Show the photo gallery"
            hint="Hidden photos are never published, even when this is on."
          />
        </div>
      </div>
    </Modal>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surf-400 focus-visible:ring-offset-2",
          checked ? "bg-surf-400" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
      <div
        onClick={() => onChange(!checked)}
        className="min-w-0 flex-1 cursor-pointer select-none"
      >
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        <span className="block text-xs text-ink-600">{hint}</span>
      </div>
    </div>
  );
}
