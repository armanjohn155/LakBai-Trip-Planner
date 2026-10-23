import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { DeleteIcon } from "@/components/features/itinerary/trip-card";
import { CheckIcon, ClockIcon, GripIcon, PencilIcon, PinIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { ItineraryItem } from "@/lib/types";
import { formatDuration, formatTimeRange } from "@/components/features/itinerary/itinerary-constants";

interface StopCardProps {
  item: ItineraryItem;
  sequence: number;
  busy?: boolean;
  canEdit?: boolean;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocus?: () => void;
}

export function StopCard({ item, sequence, busy = false, canEdit = true, onToggleStatus, onEdit, onDelete, onFocus }: StopCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const time = formatTimeRange(item.start_time, item.duration_minutes);
  const isDone = item.status === "done";
  const isSkipped = item.status === "skipped";

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "glass group relative rounded-xl p-3 transition",
        isDragging && "z-10 opacity-70 shadow-lg",
        isSkipped && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isDone ? "bg-mango-400 text-lagoon-950" : "bg-lagoon-900 text-sand-50",
          )}
          aria-hidden="true"
        >
          {sequence}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={canEdit ? onEdit : onFocus} className="min-w-0 text-left" title={canEdit ? `Edit ${item.title}` : `Show ${item.title} on map`}>
              <span className={cn("block truncate text-sm font-semibold", isSkipped ? "text-ink-600 line-through" : "text-ink-900")}>
                {item.title}
              </span>
            </button>
            {item.verified ? (
              <Badge tone="surf" className="gap-1">
                <CheckIcon className="h-3 w-3" /> Visited
              </Badge>
            ) : null}
            {item.unavailable ? <Badge tone="mango">No longer available</Badge> : null}
            {isDone ? <Badge tone="mango">Done</Badge> : null}
            {isSkipped ? <Badge tone="neutral">Skipped</Badge> : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
            {item.category ? (
              <span className="inline-flex items-center gap-1">
                <PinIcon className="h-3.5 w-3.5" /> {item.category}
              </span>
            ) : null}
            {time ? (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" /> {time}
              </span>
            ) : null}
            {item.duration_minutes ? <span>{formatDuration(item.duration_minutes)}</span> : null}
            {item.estimated_budget != null ? (
              <span className="font-semibold text-sea-600">{formatMoney(item.estimated_budget)}</span>
            ) : null}
            <span className="text-ink-500">Day {item.day_number}</span>
          </div>

          {item.notes ? <p className="mt-1.5 line-clamp-2 text-xs text-ink-600">{item.notes}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onFocus}
            aria-label={`Show ${item.title} on map`}
            title="Show on map"
            className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
          >
            <PinIcon className="h-5 w-5" />
          </button>
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onToggleStatus}
                disabled={busy}
                aria-label={isDone ? `Mark ${item.title} as planned` : `Mark ${item.title} as done`}
                title={isDone ? "Mark as planned" : "Mark as done"}
                className={cn(
                  "rounded-lg p-1.5 transition-colors disabled:opacity-50",
                  isDone ? "text-mango-500 hover:bg-mango-400/15" : "text-ink-500 hover:bg-sand-100 hover:text-ink-900",
                )}
              >
                <CheckIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${item.title}`}
                title="Edit stop"
                className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${item.title}`}
                title="Drag to reorder"
                className="cursor-grab touch-none rounded-lg p-1.5 text-ink-500 transition-colors select-none hover:bg-sand-100 hover:text-ink-900 active:cursor-grabbing"
              >
                <GripIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                aria-label={`Delete ${item.title}`}
                title="Remove stop"
                className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <DeleteIcon />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
