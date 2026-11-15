import { useEffect, useMemo, useState } from "react";

import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, MapIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { RecapStop, TripPhoto } from "@/lib/types";

import { formatRecapDate, resolveRecapMediaUrl } from "./recap-utils";

interface RecapPhotoViewerProps {
  photos: TripPhoto[];
  stops?: RecapStop[];
  coverPhotoId?: number | null;
  className?: string;
  /** Optional controlled lightbox so a timeline thumbnail can open a photo. */
  openPhotoId?: number | null;
  onOpenPhotoChange?: (photoId: number | null) => void;
}

/**
 * Read-only gallery for the public recap. Member galleries use the richer
 * `RecapGallery`; this one has no upload, caption or reorder controls and only
 * ever receives the whitelisted photo payload.
 */
export function RecapPhotoViewer({
  photos,
  stops = [],
  coverPhotoId = null,
  className,
  openPhotoId,
  onOpenPhotoChange,
}: RecapPhotoViewerProps) {
  const [internalId, setInternalId] = useState<number | null>(null);
  const controlled = openPhotoId !== undefined;
  const lightboxId = controlled ? openPhotoId : internalId;

  const ordered = useMemo(() => [...photos].sort((a, b) => a.position - b.position || a.id - b.id), [photos]);
  const index = lightboxId === null ? -1 : ordered.findIndex((photo) => photo.id === lightboxId);
  const active = index >= 0 ? ordered[index] : null;

  const setLightbox = (next: number | null) => {
    if (controlled) onOpenPhotoChange?.(next);
    setInternalId(next);
  };

  const move = (direction: -1 | 1) => {
    if (index === -1) return;
    const next = ordered[(index + direction + ordered.length) % ordered.length];
    if (next) setLightbox(next.id);
  };

  useEffect(() => {
    if (lightboxId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxId, index, ordered.length]);

  const stopName = (stopId: number | null | undefined) =>
    stopId ? stops.find((stop) => stop.id === stopId)?.title ?? null : null;

  if (ordered.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center", className)}>
        <CameraIcon className="h-7 w-7 text-ink-500" />
        <p className="font-display text-xl font-medium text-lagoon-900">No photos in this recap</p>
        <p className="max-w-sm text-sm text-ink-600">The traveller kept the gallery private or did not add photos.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map((photo) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setLightbox(photo.id)}
              className="group relative aspect-square w-full overflow-hidden rounded-xl bg-sand-100 text-left ring-1 ring-inset ring-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surf-400"
              aria-label={photo.caption ?? "Open trip photo"}
            >
              <img
                src={resolveRecapMediaUrl(photo.thumbnail_url) ?? undefined}
                alt={photo.caption ?? ""}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {photo.id === coverPhotoId ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-mango-400 px-1.5 py-0.5 text-[9px] font-bold text-lagoon-950">
                  Cover
                </span>
              ) : null}
              {photo.caption ? (
                <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-lagoon-950/80 to-transparent px-2 pb-1.5 pt-4 text-[10px] text-sand-50">
                  {photo.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-lagoon-950/90 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Trip photo"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close photo"
            onClick={() => setLightbox(null)}
          />
          <div className="relative z-10 grid max-h-full w-full max-w-5xl gap-4 overflow-y-auto rounded-2xl bg-lagoon-950/95 p-3 text-sand-50 shadow-2xl sm:grid-cols-[minmax(0,1fr)_16rem] sm:p-4">
            <div className="relative flex min-h-[16rem] items-center justify-center overflow-hidden rounded-xl bg-black/40">
              <img
                src={resolveRecapMediaUrl(active.url) ?? undefined}
                alt={active.caption ?? "Trip photo"}
                className="max-h-[70vh] w-full object-contain"
              />
              {ordered.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-lagoon-950/70 p-2 text-sand-50 hover:bg-lagoon-900"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-lagoon-950/70 p-2 text-sand-50 hover:bg-lagoon-900"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sand-50/60">
                  Photo {index + 1} of {ordered.length}
                </p>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-sand-50/80 hover:bg-white/10 hover:text-white"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              {active.caption ? <p className="text-sm leading-relaxed text-sand-50/90">{active.caption}</p> : null}
              {formatRecapDate(active.taken_at) ? (
                <p className="text-xs text-sand-50/70">{formatRecapDate(active.taken_at)}</p>
              ) : null}
              {stopName(active.itinerary_item_id) ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-sand-50/75">
                  <MapIcon className="h-3.5 w-3.5" />
                  {stopName(active.itinerary_item_id)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
