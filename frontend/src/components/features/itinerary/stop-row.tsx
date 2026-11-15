import { useState } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DeleteIcon } from "@/components/features/itinerary/trip-card";
import { CheckIcon, ClockIcon, GripIcon, MoreIcon, PencilIcon, PinIcon, RouteIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDistance, haversineMeters } from "@/lib/geo";
import { formatMoney } from "@/lib/format";
import type { ItineraryItem, TripLifecycleStatus } from "@/lib/types";
import { formatDuration, formatTimeRange } from "@/components/features/itinerary/itinerary-constants";

interface StopRowProps {
  item: ItineraryItem;
  sequence: number;
  busy?: boolean;
  canEdit?: boolean;
  selected?: boolean;
  hovered?: boolean;
  flash?: boolean;
  lifecycle?: TripLifecycleStatus;
  isNext?: boolean;
  livePosition?: { lat: number; lng: number } | null;
  marking?: boolean;
  trackingActive?: boolean;
  canUndo?: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocus: () => void;
  onMarkVisited?: () => void;
  onSkipStop?: () => void;
  onUndoStop?: () => void;
}

export function StopRow({
  item,
  sequence,
  busy = false,
  canEdit = true,
  selected = false,
  hovered = false,
  flash = false,
  lifecycle = "planned",
  isNext = false,
  livePosition = null,
  marking = false,
  trackingActive = false,
  canUndo = false,
  onSelect,
  onHover,
  onToggleStatus,
  onEdit,
  onDelete,
  onFocus,
  onMarkVisited,
  onSkipStop,
  onUndoStop,
}: StopRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ongoing = lifecycle === "active" || lifecycle === "paused";
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit || ongoing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const time = formatTimeRange(item.start_time, item.duration_minutes);
  const isDone = item.status === "done";
  const isSkipped = item.status === "skipped";
  const isArrived = item.status === "arrived";
  const location = item.destination?.municipality ?? item.custom_address ?? item.destination?.region ?? null;
  const image = item.destination?.image_url ?? null;
  const radiusM = item.destination?.radius_m ?? 150;
  const distanceM =
    livePosition
      ? haversineMeters(
          { latitude: livePosition.lat, longitude: livePosition.lng },
          { latitude: item.latitude, longitude: item.longitude },
        )
      : null;
  const near = distanceM !== null && distanceM <= radiusM;
  const canManageLive = ongoing && (item.status === "planned" || isArrived);

  const actionButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 disabled:opacity-50 sm:h-8 sm:w-8";

  const actions = (
    <>
      <button type="button" onClick={onFocus} aria-label={`Show ${item.title} on map`} title="Show on map" className={actionButtonClass}>
        <PinIcon className="h-4 w-4" />
      </button>
      {canEdit ? (
        <>
          {!ongoing ? (
            <button
              type="button"
              onClick={onToggleStatus}
              disabled={busy}
              aria-label={isDone ? `Mark ${item.title} as planned` : `Mark ${item.title} as done`}
              title={isDone ? "Mark as planned" : "Mark as done"}
              className={cn(actionButtonClass, isDone && "text-mango-500 hover:bg-mango-400/15")}
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          ) : null}
          <button type="button" onClick={onEdit} aria-label={`Edit ${item.title}`} title="Edit stop" className={actionButtonClass}>
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete ${item.title}`}
            title="Remove stop"
            className={cn(actionButtonClass, "hover:bg-red-50 hover:text-red-600")}
          >
            <DeleteIcon />
          </button>
        </>
      ) : null}
    </>
  );

  return (
    <li
      ref={setNodeRef}
      id={`trip-stop-${item.id}`}
      style={style}
      className={cn("group relative scroll-mt-28", isDragging && "z-20 opacity-70")}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            "relative min-w-0 flex-1 rounded-xl border border-transparent px-2 py-2 transition-colors",
            selected && "border-surf-400/40 bg-surf-400/10",
            !selected && hovered && "bg-sand-50",
            isSkipped && "opacity-70",
            item.unavailable && "bg-mango-400/5",
            flash && "stop-row-flash",
          )}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }}
            className="flex w-full cursor-pointer items-start gap-3 text-left focus:outline-none"
          >
            <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand-100 text-ink-500 ring-1 ring-inset ring-line/60">
              {image ? (
                <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <PinIcon className="h-5 w-5" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5 pr-14 sm:pr-20">
                <span className={cn("min-w-0 truncate text-sm font-semibold", isSkipped ? "text-ink-600 line-through" : "text-ink-900")}>
                  {item.title}
                </span>
                {item.verified ? (
                  <Badge tone="surf" className="gap-1">
                    <CheckIcon className="h-3 w-3" /> Verified
                  </Badge>
                ) : null}
                {item.unavailable ? <Badge tone="mango">No longer available</Badge> : null}
                {isDone ? (
                  <Badge tone="mango">Done</Badge>
                ) : isSkipped ? (
                  <Badge tone="neutral">Skipped</Badge>
                ) : isArrived ? (
                  <Badge tone="surf">Arrived</Badge>
                ) : isNext && (ongoing || livePosition !== null) ? (
                  <Badge tone="sea">Up next</Badge>
                ) : null}
              </span>

              {location ? <span className="mt-0.5 block truncate text-xs text-ink-600">{location}</span> : null}

              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-600">
                {time ? (
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" /> {time}
                  </span>
                ) : null}
                {item.duration_minutes ? <span>{formatDuration(item.duration_minutes)}</span> : null}
                {item.estimated_budget != null ? (
                  <span className="font-semibold text-sea-600">{formatMoney(item.estimated_budget)}</span>
                ) : null}
                {distanceM !== null ? (
                  <span className={cn("inline-flex items-center gap-1", near ? "font-semibold text-sea-600" : "text-ink-500")}>
                    <RouteIcon className="h-3.5 w-3.5" /> {formatDistance(distanceM)} away
                  </span>
                ) : null}
              </span>

              {item.notes ? <span className="mt-1 line-clamp-2 block text-xs text-ink-600">{item.notes}</span> : null}
            </span>
          </div>

          {canManageLive ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[3.75rem]">
              {trackingActive ? (
                <Button
                  size="sm"
                  variant={near ? "primary" : "secondary"}
                  onClick={onMarkVisited}
                  disabled={marking}
                  title={
                    near
                      ? "Verify your location and mark this stop visited"
                      : "Send your current location to the server for verification"
                  }
                >
                  {marking ? "Checking..." : near ? "Mark visited" : "I'm here"}
                </Button>
              ) : (
                <span className="text-[11px] font-medium text-ink-500">Resume the trip to mark stops visited.</span>
              )}
              <Button size="sm" variant="danger" onClick={onSkipStop} disabled={marking}>
                Skip
              </Button>
              {near ? <span className="text-[10px] font-semibold text-sea-600">Inside {radiusM} m</span> : null}
            </div>
          ) : null}

          {ongoing && (isDone || isSkipped) && canUndo && onUndoStop ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[3.75rem]">
              <Button size="sm" variant="secondary" onClick={onUndoStop} disabled={marking}>
                Undo
              </Button>
              <span className="text-[10px] text-ink-500">Undo within 10 minutes</span>
            </div>
          ) : null}

          <div className="absolute right-1 top-1 hidden items-center gap-0.5 rounded-full bg-white/95 p-0.5 shadow-sm ring-1 ring-line/60 sm:flex sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {actions}
          </div>

          <div className="absolute right-1 top-1 sm:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label={`Actions for ${item.title}`}
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-ink-600 shadow-sm ring-1 ring-line/60 sm:h-9 sm:w-9"
            >
              <MoreIcon className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 top-10 z-40 w-44 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-line/60">
                  {actions}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="relative flex w-9 shrink-0 flex-col items-center">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" aria-hidden="true" />
          <span
            className={cn(
              "relative z-10 mt-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white",
              isDone ? "bg-mango-400 text-lagoon-950" : "bg-lagoon-900 text-sand-50",
              selected && "ring-surf-400/30",
            )}
            aria-label={`Stop ${sequence}`}
          >
            {sequence}
          </span>
          {canEdit && !ongoing ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${item.title}`}
              title="Drag to reorder"
              className="relative z-10 mb-1 mt-auto flex h-11 w-11 touch-none cursor-grab items-center justify-center rounded-full text-ink-500 transition-colors select-none hover:bg-sand-100 hover:text-ink-900 active:cursor-grabbing sm:h-8 sm:w-8"
            >
              <GripIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
