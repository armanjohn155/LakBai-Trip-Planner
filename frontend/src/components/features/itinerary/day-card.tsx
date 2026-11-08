import { Fragment } from "react";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { LegConnector } from "@/components/features/itinerary/leg-connector";
import { StopRow } from "@/components/features/itinerary/stop-row";
import { ChevronIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { ItineraryItem, ItineraryRouteLeg, ItinerarySummaryDay } from "@/lib/types";
import { formatDayHeading, formatDuration } from "@/components/features/itinerary/itinerary-constants";

interface DayCardProps {
  group: { day: number; items: ItineraryItem[] };
  groups: { day: number; items: ItineraryItem[] }[];
  groupIndex: number;
  startDate?: string | null;
  summary?: ItinerarySummaryDay;
  busyItem: number | null;
  estimatesEnabled: boolean;
  canEdit: boolean;
  travelByLeg: Map<string, ItineraryRouteLeg>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedItemId: number | null;
  hoveredItemId: number | null;
  onSelectItem: (item: ItineraryItem) => void;
  onHoverItem: (id: number | null) => void;
  onToggleStatus: (item: ItineraryItem) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDeleteItem: (item: ItineraryItem) => void;
  onFocusItem: (item: ItineraryItem) => void;
}

export function DayCard({
  group,
  groups,
  groupIndex,
  startDate,
  summary,
  busyItem,
  estimatesEnabled,
  canEdit,
  travelByLeg,
  collapsed,
  onToggleCollapse,
  selectedItemId,
  hoveredItemId,
  onSelectItem,
  onHoverItem,
  onToggleStatus,
  onEditItem,
  onDeleteItem,
  onFocusItem,
}: DayCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${group.day}` });
  const ids = group.items.map((item) => item.id);
  const offset = groups.slice(0, groupIndex).reduce((total, current) => total + current.items.length, 0);
  const heading = formatDayHeading(startDate, group.day);
  const duration = summary?.duration_minutes ?? group.items.reduce((total, item) => total + (item.duration_minutes ?? 0), 0);

  return (
    <section ref={setNodeRef} className={cn("rounded-2xl transition-colors", isOver && "bg-surf-400/10 ring-1 ring-surf-400/40")}>
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 pb-1.5 pt-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left"
        >
          <ChevronIcon className={cn("h-4 w-4 shrink-0 text-ink-500 transition-transform", collapsed && "-rotate-90")} />
          <span className="truncate font-display text-sm font-semibold text-lagoon-900">{heading ?? `Day ${group.day}`}</span>
          {heading ? (
            <span className="shrink-0 rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
              Day {group.day}
            </span>
          ) : null}
        </button>
        <p className="text-[11px] text-ink-600">
          {summary?.item_count ?? group.items.length} {(summary?.item_count ?? group.items.length) === 1 ? "stop" : "stops"}
          {duration > 0 ? ` · ${formatDuration(duration)}` : ""}
          {summary?.estimated_budget != null ? ` · ${formatMoney(summary.estimated_budget)}` : ""}
        </p>
      </header>

      {collapsed ? null : (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-0.5 px-0.5">
            {group.items.map((item, itemIndex) => {
              const next = group.items[itemIndex + 1];
              const leg = next ? travelByLeg.get(`${item.id}-${next.id}`) : undefined;
              return (
                <Fragment key={item.id}>
                  <StopRow
                    item={item}
                    sequence={offset + itemIndex + 1}
                    busy={busyItem === item.id}
                    canEdit={canEdit}
                    selected={selectedItemId === item.id}
                    hovered={hoveredItemId === item.id}
                    onSelect={() => onSelectItem(item)}
                    onHover={(hovered) => onHoverItem(hovered ? item.id : null)}
                    onToggleStatus={() => onToggleStatus(item)}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item)}
                    onFocus={() => onFocusItem(item)}
                  />
                  {next ? (
                    <li className="flex items-stretch gap-2">
                      <div className="min-w-0 flex-1">
                        <LegConnector from={item} to={next} leg={leg} estimatesEnabled={estimatesEnabled} />
                      </div>
                      <div className="relative w-9 shrink-0">
                        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" aria-hidden="true" />
                      </div>
                    </li>
                  ) : null}
                </Fragment>
              );
            })}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}
