import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { CheckIcon, ChevronRightIcon, ClockIcon, PinIcon, StarIcon } from "@/components/icons";
import { dayColor } from "@/components/features/map/map-pin";
import { cn } from "@/lib/cn";
import type { RecapStop, TripPhoto } from "@/lib/types";

import { formatRecapTime, groupStopsByDay, resolveRecapMediaUrl, stopAnchorId } from "./recap-utils";

const statusLabel: Record<string, string> = {
  done: "Visited",
  arrived: "Arrived",
  skipped: "Skipped",
  planned: "Planned",
};

interface RecapStopTimelineProps {
  stops: RecapStop[];
  photos: TripPhoto[];
  /** Member payloads carry destination ids and review links. */
  showReviewLinks?: boolean;
  onOpenPhoto?: (photoId: number) => void;
  onFocusStop?: (stopId: number) => void;
  className?: string;
}

export function RecapStopTimeline({
  stops,
  photos,
  showReviewLinks = false,
  onOpenPhoto,
  onFocusStop,
  className,
}: RecapStopTimelineProps) {
  const days = groupStopsByDay(stops);
  const photosByStop = new Map<number, TripPhoto[]>();

  for (const photo of photos) {
    if (photo.itinerary_item_id === null) continue;
    const bucket = photosByStop.get(photo.itinerary_item_id) ?? [];
    bucket.push(photo);
    photosByStop.set(photo.itinerary_item_id, bucket);
  }

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-600">
        No stops were recorded for this trip.
      </p>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      {days.map(({ day, stops: dayStops }) => (
        <section key={day} aria-label={`Day ${day}`}>
          <div className="mb-3 flex items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-lagoon-950"
              style={{ backgroundColor: dayColor(day) }}
            >
              {day}
            </span>
            <h3 className="font-display text-lg font-semibold text-lagoon-900">Day {day}</h3>
            <span className="text-xs text-ink-500">
              {dayStops.length} {dayStops.length === 1 ? "stop" : "stops"}
            </span>
            <span className="h-px flex-1 bg-line/70" aria-hidden="true" />
          </div>

          <ol className="space-y-3">
            {dayStops.map((stop) => {
              const captured = photosByStop.get(stop.id) ?? [];
              const when = formatRecapTime(stop.completed_at ?? stop.arrived_at);
              const isSkipped = stop.status === "skipped";
              const hasCoordinates = stop.latitude !== null && stop.longitude !== null;

              return (
                <li key={stop.id} id={stopAnchorId(stop.id)} className="scroll-mt-24">
                  <div
                    className={cn(
                      "group rounded-2xl bg-white/80 p-4 ring-1 ring-inset ring-line/60 backdrop-blur-sm transition-shadow hover:shadow-md",
                      isSkipped && "opacity-70",
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand-100">
                        {stop.image_url ? (
                          <img
                            src={resolveRecapMediaUrl(stop.image_url) ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <PinIcon className="h-5 w-5 text-ink-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-lagoon-900">{stop.title}</h4>
                          <Badge tone={stop.status === "done" ? "sea" : stop.status === "skipped" ? "neutral" : "mango"}>
                            {statusLabel[stop.status] ?? "Planned"}
                          </Badge>
                          {stop.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sea-500/10 px-2 py-0.5 text-[11px] font-semibold text-sea-600">
                              <CheckIcon className="h-3 w-3" /> Verified
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
                          {stop.municipality ? <span>{stop.municipality}</span> : null}
                          {stop.category ? <span className="rounded-full bg-sand-100 px-2 py-0.5">{stop.category}</span> : null}
                          {when ? (
                            <span className="inline-flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {when}
                            </span>
                          ) : null}
                          {hasCoordinates && onFocusStop ? (
                            <button
                              type="button"
                              onClick={() => onFocusStop(stop.id)}
                              className="inline-flex items-center gap-0.5 font-semibold text-sea-600 hover:text-sea-500"
                            >
                              Show on map <ChevronRightIcon className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>

                        {stop.notes ? (
                          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-700">{stop.notes}</p>
                        ) : null}

                        {showReviewLinks && stop.destination_id ? (
                          <Link
                            to={`/destinations/${stop.destination_id}#reviews`}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sea-600 hover:text-sea-500"
                          >
                            <StarIcon className="h-3.5 w-3.5 text-mango-400" />
                            Leave a review
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    {captured.length > 0 ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {captured.map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => onOpenPhoto?.(photo.id)}
                            className="h-16 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-line/70 transition-transform hover:scale-[1.03] focus-visible:outline-none"
                            aria-label={photo.caption ?? "Open trip photo"}
                          >
                            <img
                              src={resolveRecapMediaUrl(photo.thumbnail_url) ?? undefined}
                              alt={photo.caption ?? ""}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
