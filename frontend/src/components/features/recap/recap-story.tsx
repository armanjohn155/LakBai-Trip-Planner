import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { dayColor } from "@/components/features/map/map-pin";
import { CameraIcon, MapIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type {
  RecapAccent,
  RecapMember,
  RecapRoute,
  RecapStats,
  RecapStop,
  TripPhoto,
} from "@/lib/types";

import { RecapHero } from "./recap-hero";
import { RecapMap } from "./recap-map";
import { RecapPhotoViewer } from "./recap-photo-viewer";
import { RecapStatsStrip } from "./recap-stats";
import { RecapStopTimeline } from "./recap-stop-timeline";

interface RecapStoryProps {
  title: string;
  summary: string | null;
  startDate: string | null;
  endDate: string | null;
  dayCount: number;
  coverPhoto: TripPhoto | null;
  accent: RecapAccent;
  members?: RecapMember[];
  memberCount?: number;
  stats: RecapStats | null;
  showStats: boolean;
  hideEndpoints: boolean;
  route: RecapRoute;
  stops: RecapStop[];
  photos: TripPhoto[];
  /** Member recaps can deep-link to reviews; the public page cannot. */
  showReviewLinks?: boolean;
  actions?: ReactNode;
  eyebrow?: string;
  showPhotos?: boolean;
  renderGallery?: (state: {
    openPhotoId: number | null;
    onOpenPhotoChange: (photoId: number | null) => void;
  }) => ReactNode;
  className?: string;
}

/**
 * The shared story layout behind both the member recap and `/s/:token`.
 * Member-only affordances (design/share actions, editable gallery, review
 * links) are injected so the public page cannot accidentally show them.
 */
export function RecapStory({
  title,
  summary,
  startDate,
  endDate,
  dayCount,
  coverPhoto,
  accent,
  members = [],
  memberCount,
  stats,
  showStats,
  hideEndpoints,
  route,
  stops,
  photos,
  showReviewLinks = false,
  actions,
  eyebrow,
  showPhotos = true,
  renderGallery,
  className,
}: RecapStoryProps) {
  const [openPhotoId, setOpenPhotoId] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ point: [number, number] | null; nonce: number }>({
    point: null,
    nonce: 0,
  });
  const mapRef = useRef<HTMLDivElement>(null);

  const onFocusStop = useCallback(
    (stopId: number) => {
      const stop = stops.find((entry) => entry.id === stopId);
      if (!stop || stop.latitude === null || stop.longitude === null) return;
      setFocus((current) => ({ point: [stop.latitude as number, stop.longitude as number], nonce: current.nonce + 1 }));
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [stops],
  );

  const days = useMemo(
    () => [...new Set(stops.map((stop) => stop.day_number))].sort((a, b) => a - b),
    [stops],
  );

  const gallery = renderGallery ? (
    renderGallery({ openPhotoId, onOpenPhotoChange: setOpenPhotoId })
  ) : null;

  return (
    <div className={cn("space-y-7", className)}>
      <RecapHero
        title={title}
        summary={summary}
        startDate={startDate}
        endDate={endDate}
        dayCount={dayCount}
        coverUrl={coverPhoto?.url ?? null}
        accent={accent}
        members={members}
        memberCount={memberCount}
        actions={actions}
        eyebrow={eyebrow}
      />

      {showStats && stats ? <RecapStatsStrip stats={stats} accent={accent} /> : null}

      {stops.length > 0 ? (
        <section ref={mapRef} className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-semibold text-lagoon-900">The route</h2>
              <p className="mt-0.5 text-sm text-ink-600">
                {days.length === 1 ? "One day" : `${days.length} days`} of movement, coloured by day.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {days.map((day) => (
                <span key={day} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: dayColor(day) }}
                    aria-hidden="true"
                  />
                  Day {day}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl ring-1 ring-inset ring-line/60">
            <div className="h-[22rem] w-full sm:h-[26rem]">
              <RecapMap
                route={route}
                stops={stops}
                photos={photos}
                hideEndpoints={hideEndpoints}
                focusPoint={focus.point}
                focusNonce={focus.nonce}
                onSelectStop={onFocusStop}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-lagoon-900">Where you went</h2>
          <p className="mt-0.5 text-sm text-ink-600">
            {stops.length} {stops.length === 1 ? "stop" : "stops"} across {dayCount === 1 ? "one day" : `${dayCount} days`}.
          </p>
        </div>
        <RecapStopTimeline
          stops={stops}
          photos={photos}
          showReviewLinks={showReviewLinks}
          onOpenPhoto={setOpenPhotoId}
          onFocusStop={onFocusStop}
        />
      </section>

      {gallery ? (
        gallery
      ) : showPhotos && photos.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CameraIcon className="h-5 w-5 text-sea-600" />
            <h2 className="font-display text-2xl font-semibold text-lagoon-900">Photo memories</h2>
          </div>
          <RecapPhotoViewer
            photos={photos}
            stops={stops}
            coverPhotoId={coverPhoto?.id ?? null}
            openPhotoId={openPhotoId}
            onOpenPhotoChange={setOpenPhotoId}
          />
        </section>
      ) : null}

      {!showPhotos && !renderGallery ? (
        <p className="flex items-center gap-2 rounded-2xl bg-sand-50 px-4 py-3 text-sm text-ink-600 ring-1 ring-inset ring-line/60">
          <MapIcon className="h-4 w-4" />
          The traveller chose to keep the photo gallery off the public page.
        </p>
      ) : null}
    </div>
  );
}
