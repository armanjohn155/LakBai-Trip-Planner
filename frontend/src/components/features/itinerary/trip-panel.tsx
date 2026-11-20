/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";

import { BudgetFooter } from "@/components/features/itinerary/budget-footer";
import { isBudgetHidden } from "@/components/features/itinerary/budget-summary";
import { DayCard } from "@/components/features/itinerary/day-card";
import { ExportMenu } from "@/components/features/itinerary/export-menu";
import {
  LIFECYCLE_LABEL,
  formatDuration,
} from "@/components/features/itinerary/itinerary-constants";
import { Avatar } from "@/components/features/profile/profile-sidebar";
import {
  ChevronIcon,
  ClockIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  ShareIcon,
  SlidersIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";
import { formatMoney } from "@/lib/format";
import type {
  Itinerary,
  ItineraryItem,
  ItineraryRouteLeg,
  ItinerarySummary,
  ItinerarySummaryDay,
  TripLifecycleStatus,
} from "@/lib/types";

export type MobileSnap = "peek" | "half" | "full";

export const MOBILE_PEEK_HEIGHT = 136;

export function mobileSheetHeight(snap: MobileSnap, viewportHeight: number, bottomInset = 0): number {
  const available = Math.max(viewportHeight - 64 - bottomInset, 260);
  if (snap === "peek") return Math.min(MOBILE_PEEK_HEIGHT, available);
  if (snap === "half") return Math.round(available * 0.56);
  return Math.round(available * 0.9);
}

interface DayGroup {
  day: number;
  items: ItineraryItem[];
}

interface TripPanelProps {
  itinerary: Itinerary;
  summary: ItinerarySummary;
  groups: DayGroup[];
  canEdit: boolean;
  isOwner: boolean;
  isGroup: boolean;
  busyItem: number | null;
  estimatesEnabled: boolean;
  travelByLeg: Map<string, ItineraryRouteLeg>;
  daySummaryByDay: Map<number, ItinerarySummaryDay>;
  totalDistanceM: number | null;
  selectedItemId: number | null;
  hoveredItemId: number | null;
  flashItemId: number | null;
  scrollRequest: { id: number; nonce: number } | null;
  lifecycle: TripLifecycleStatus;
  nextStopId: number | null;
  livePosition: { lat: number; lng: number } | null;
  markingItemId: number | null;
  startBusy: boolean;
  trackingActive: boolean;
  onStartTrip: () => void;
  onMarkVisited: (item: ItineraryItem) => void;
  onSkipStop: (item: ItineraryItem) => void;
  onUndoStop: (item: ItineraryItem) => void;
  canUndoStop: (item: ItineraryItem) => boolean;
  addOpen: boolean;
  onOpenAdd: () => void;
  onOpenSettings: () => void;
  onOpenActivity: () => void;
  onOpenTemplates: () => void;
  onOpenShare: () => void;
  onExportError: (message: string) => void;
  itemError: string | null;
  notice?: ReactNode;
  party?: ReactNode;
  collapsed: boolean;
  hidden: boolean;
  width: number;
  resizable: boolean;
  onResize: (width: number) => void;
  onToggleCollapse: () => void;
  onHide: () => void;
  isMobile: boolean;
  mobileSnap: MobileSnap;
  mobileHeight: number;
  mobileBottomInset?: number;
  onMobileSnapChange: (snap: MobileSnap) => void;
  onSelectItem: (item: ItineraryItem) => void;
  onHoverItem: (id: number | null) => void;
  onToggleStatus: (item: ItineraryItem) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDeleteItem: (item: ItineraryItem) => void;
  onFocusItem: (item: ItineraryItem) => void;
}

export function TripPanel({
  itinerary,
  summary,
  groups,
  canEdit,
  isOwner,
  isGroup,
  busyItem,
  estimatesEnabled,
  travelByLeg,
  daySummaryByDay,
  totalDistanceM,
  selectedItemId,
  hoveredItemId,
  flashItemId,
  scrollRequest,
  lifecycle,
  nextStopId,
  livePosition,
  markingItemId,
  startBusy,
  trackingActive,
  onStartTrip,
  onMarkVisited,
  onSkipStop,
  onUndoStop,
  canUndoStop,
  addOpen,
  onOpenAdd,
  onOpenSettings,
  onOpenActivity,
  onOpenTemplates,
  onOpenShare,
  onExportError,
  itemError,
  notice,
  party,
  collapsed,
  hidden,
  width,
  resizable,
  onResize,
  onToggleCollapse,
  onHide,
  isMobile,
  mobileSnap,
  mobileHeight,
  mobileBottomInset = 0,
  onMobileSnapChange,
  onSelectItem,
  onHoverItem,
  onToggleStatus,
  onEditItem,
  onDeleteItem,
  onFocusItem,
}: TripPanelProps) {
  const handleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(() => new Set());
  const [failedCover, setFailedCover] = useState<string | null>(null);

  const firstImage = useMemo(
    () => groups.flatMap((group) => group.items).find((item) => item.destination?.image_url)?.destination?.image_url ?? null,
    [groups],
  );
  const cover = itinerary.cover_image_url || firstImage;
  const showCover = cover !== null && failedCover !== cover;
  const budgetHidden = isBudgetHidden(summary);
  const isCollapsed = !isMobile && collapsed;
  const ongoing = lifecycle === "active" || lifecycle === "paused";
  const lifecycleDot: Record<TripLifecycleStatus, string> = {
    planned: "bg-white/60",
    active: "bg-emerald-400",
    paused: "bg-mango-400",
    completed: "bg-sea-300",
    cancelled: "bg-white/40",
  };

  const memberAvatars = (itinerary.members ?? []).slice(0, 4);
  const extraMembers = Math.max((itinerary.member_count ?? itinerary.members?.length ?? 0) - memberAvatars.length, 0);

  const stats = useMemo(() => {
    const parts = [
      `${summary.item_count} ${summary.item_count === 1 ? "stop" : "stops"}`,
      summary.total_duration_minutes > 0 ? formatDuration(summary.total_duration_minutes) : null,
      totalDistanceM !== null ? formatDistance(totalDistanceM) : null,
      budgetHidden ? "Budget private" : formatMoney(summary.total_budget),
    ];
    return parts.filter(Boolean);
  }, [summary, totalDistanceM, budgetHidden]);

  // Expand the target day and scroll a marker's stop row into view.
  useEffect(() => {
    if (!scrollRequest) return;
    const target = groups.flatMap((group) => group.items).find((item) => item.id === scrollRequest.id);
    if (!target) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedDays((current) => {
      if (!current.has(target.day_number)) return current;
      const next = new Set(current);
      next.delete(target.day_number);
      return next;
    });

    const run = () => {
      document.getElementById(`trip-stop-${scrollRequest.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    const frame = window.requestAnimationFrame(run);
    const timer = window.setTimeout(run, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest?.nonce]);

  if (hidden && !isMobile) return null;

  const toggleDay = (day: number) => {
    setCollapsedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    const currentHeight = dragHeight ?? drag.startHeight;
    dragRef.current = null;
    setDragHeight(null);

    if (!drag.moved) {
      const nextSnap: MobileSnap = mobileSnap === "peek" ? "half" : mobileSnap === "half" ? "full" : "peek";
      onMobileSnapChange(nextSnap);
      return;
    }

    const available = Math.max(window.innerHeight - 64 - mobileBottomInset, 260);
    const peek = Math.min(MOBILE_PEEK_HEIGHT, available);
    const heights: Array<[MobileSnap, number]> = [
      ["peek", peek],
      ["half", Math.round(available * 0.56)],
      ["full", Math.round(available * 0.9)],
    ];
    const nearest = heights.reduce((best, entry) =>
      Math.abs(entry[1] - currentHeight) < Math.abs(best[1] - currentHeight) ? entry : best,
    );
    onMobileSnapChange(nearest[0]);
  };

  const sheetStyle = isMobile
    ? { height: `${dragHeight ?? mobileHeight}px`, bottom: `${mobileBottomInset}px` }
    : { width: `${width}px` };

  const panelClasses = cn(
    "group/panel pointer-events-auto absolute z-[1000] flex flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-line/60",
    isMobile
      ? "inset-x-0 rounded-t-3xl rounded-b-none transition-[height] duration-200 ease-out"
      : "bottom-4 left-4 top-4 rounded-2xl",
    !isMobile && isCollapsed && "bottom-auto h-auto",
  );

  return (
    <aside aria-label="Trip panel" className={panelClasses} style={sheetStyle}>
      {!isMobile && resizable && !isCollapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize trip panel"
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeRef.current = { startX: event.clientX, startWidth: width };
          }}
          onPointerMove={(event) => {
            const resize = resizeRef.current;
            if (!resize) return;
            onResize(resize.startWidth + (event.clientX - resize.startX));
          }}
          onPointerUp={() => {
            resizeRef.current = null;
          }}
          onPointerCancel={() => {
            resizeRef.current = null;
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              onResize(width - 24);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              onResize(width + 24);
            }
          }}
          className="absolute inset-y-2 right-0 z-10 flex w-2 cursor-col-resize touch-none items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-surf-400"
        >
          <span
            className="h-10 w-1 rounded-full bg-line transition-colors hover:bg-surf-400/60 group-hover/panel:bg-surf-400/40"
            aria-hidden="true"
          />
        </div>
      ) : null}

      {isMobile ? (
        <button
          ref={handleRef}
          type="button"
          aria-label="Resize trip panel"
          className="flex h-6 w-full shrink-0 touch-none items-center justify-center"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { startY: event.clientY, startHeight: mobileHeight, moved: false };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const delta = drag.startY - event.clientY;
            if (Math.abs(delta) > 4) drag.moved = true;
            const available = Math.max(window.innerHeight - 64 - mobileBottomInset, 260);
            const peek = Math.min(MOBILE_PEEK_HEIGHT, available);
            setDragHeight(Math.max(peek, Math.min(available - 8, drag.startHeight + delta)));
          }}
          onPointerUp={finishDrag}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragHeight(null);
          }}
        >
          <span className="h-1 w-10 rounded-full bg-sand-300" aria-hidden="true" />
        </button>
      ) : null}

      <div className="flex shrink-0 items-start gap-2 border-b border-line/60 px-3 py-2.5">
        <button
          type="button"
          onClick={() => (isMobile ? onMobileSnapChange(mobileSnap === "peek" ? "half" : "peek") : onToggleCollapse())}
          aria-label={isCollapsed ? "Expand trip panel" : "Collapse trip panel"}
          aria-expanded={!isCollapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
        >
          <ChevronIcon className={cn("h-4 w-4 transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Trip</p>
            {!canEdit ? (
              <span className="rounded-full bg-mango-400/20 px-2 py-0.5 text-[10px] font-semibold text-ink-700">View only</span>
            ) : null}
          </div>
          <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-[11px] leading-snug text-ink-600">
            {stats.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={onOpenAdd}
            disabled={ongoing}
            aria-label={ongoing ? "Pause or finish the trip to add stops" : "Add a stop"}
            title={ongoing ? "Pause or finish the trip to add stops" : "Add a stop"}
            aria-pressed={addOpen}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              addOpen ? "bg-surf-400/15 text-sea-600" : "text-ink-500 hover:bg-sand-100 hover:text-ink-900",
            )}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        ) : null}

        {!isMobile ? (
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide trip panel"
            title="Hide panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isCollapsed ? null : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="relative mx-3 mt-3 overflow-hidden rounded-2xl">
              <div className="relative h-28 bg-gradient-to-br from-lagoon-900 via-sea-600 to-surf-400">
                {showCover ? (
                  <img
                    src={cover ?? ""}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={() => setFailedCover(cover ?? null)}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-lagoon-950/90 via-lagoon-950/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={canEdit ? onOpenSettings : undefined}
                        disabled={!canEdit}
                        className="min-w-0 text-left disabled:cursor-default"
                        title={canEdit ? "Edit trip details" : itinerary.title}
                      >
                        <span className="block truncate font-display text-lg font-semibold text-white">{itinerary.title}</span>
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          aria-label="Edit trip details"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {isGroup ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                          <ShareIcon className="h-3 w-3" /> Group
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Solo
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                        <span className={cn("h-1.5 w-1.5 rounded-full", lifecycleDot[lifecycle])} aria-hidden="true" />
                        {LIFECYCLE_LABEL[lifecycle]}
                      </span>

                      {isGroup && memberAvatars.length > 0 ? (
                        <span className="flex items-center">
                          {memberAvatars.map((member) => (
                            <Avatar
                              key={member.id}
                              name={member.name}
                              src={member.avatar_url ?? null}
                              className="-ml-1.5 h-6 w-6 text-[10px] first:ml-0 ring-2 ring-white/70"
                            />
                          ))}
                          {extraMembers > 0 ? (
                            <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold text-white ring-2 ring-white/70">
                              +{extraMembers}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {canEdit && lifecycle === "planned" ? (
                <Button size="sm" onClick={onStartTrip} disabled={startBusy || summary.item_count === 0} className="shrink-0">
                  <RouteIcon className="h-4 w-4" /> {startBusy ? "Starting..." : "Start trip"}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  size="sm"
                  variant={lifecycle === "planned" ? "secondary" : "primary"}
                  onClick={onOpenAdd}
                  disabled={ongoing}
                  aria-pressed={addOpen}
                  title={ongoing ? "Pause or finish the trip to add stops" : undefined}
                  className={cn("shrink-0", addOpen && "ring-2 ring-inset ring-white/50")}
                >
                  <PlusIcon className="h-4 w-4" /> Add a stop
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={onOpenActivity} className="shrink-0">
                <ClockIcon className="h-4 w-4" /> Activity
              </Button>
              {canEdit ? (
                <Button size="sm" variant="secondary" onClick={onOpenTemplates} className="shrink-0">
                  <LayersIcon className="h-4 w-4" /> Templates
                </Button>
              ) : null}
              {canEdit ? (
                <Button size="sm" variant="secondary" onClick={onOpenSettings} className="shrink-0">
                  <SlidersIcon className="h-4 w-4" /> Settings
                </Button>
              ) : null}
              <div className="shrink-0">
                <ExportMenu itinerary={itinerary} onError={onExportError} />
              </div>
              <Button size="sm" onClick={onOpenShare} className="shrink-0">
                <ShareIcon className="h-4 w-4" /> {isOwner ? "Share" : "Members"}
              </Button>
            </div>

            {notice ? <div className="px-3 pb-2">{notice}</div> : null}
            {party ? <div className="px-3 pb-2">{party}</div> : null}
            {itemError ? (
              <p role="alert" className="mx-3 mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-200">
                {itemError}
              </p>
            ) : null}

            {groups.length === 0 ? (
              <div className="px-3 pb-4">
                <EmptyState
                  title="Add your first stop"
                  detail="Pick a destination, or drop a custom pin on the map."
                  action={
                    canEdit ? (
                      <Button size="sm" onClick={onOpenAdd}>
                        <PlusIcon className="h-4 w-4" /> Add your first stop
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="space-y-1 px-2 pb-3">
                {groups.map((group, groupIndex) => (
                  <DayCard
                    key={group.day}
                    group={group}
                    groups={groups}
                    groupIndex={groupIndex}
                    startDate={itinerary.start_date}
                    summary={daySummaryByDay.get(group.day)}
                    busyItem={busyItem}
                    estimatesEnabled={estimatesEnabled}
                    canEdit={canEdit}
                    travelByLeg={travelByLeg}
                    collapsed={collapsedDays.has(group.day)}
                    onToggleCollapse={() => toggleDay(group.day)}
                    selectedItemId={selectedItemId}
                    hoveredItemId={hoveredItemId}
                    flashItemId={flashItemId}
                    lifecycle={lifecycle}
                    nextStopId={nextStopId}
                    livePosition={livePosition}
                    markingItemId={markingItemId}
                    trackingActive={trackingActive}
                    canUndoStop={canUndoStop}
                    onMarkVisited={onMarkVisited}
                    onSkipStop={onSkipStop}
                    onUndoStop={onUndoStop}
                    onSelectItem={onSelectItem}
                    onHoverItem={onHoverItem}
                    onToggleStatus={onToggleStatus}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                    onFocusItem={onFocusItem}
                  />
                ))}
                {canEdit ? <NewDayDrop day={(groups[groups.length - 1]?.day ?? 0) + 1} /> : null}
                {!canEdit ? (
                  <p className="px-2 pt-2 text-xs text-ink-600">
                    You have view-only access. Explore the map, open stops and export a copy.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <BudgetFooter summary={summary} className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
        </>
      )}
    </aside>
  );
}

function NewDayDrop({ day }: { day: number }) {
  // The builder reads "day-N" ids when a stop lands on an empty day.
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-dashed border-line px-3 py-3 text-center text-xs text-ink-500 transition-colors",
        isOver && "border-surf-400 bg-surf-400/10 text-sea-600",
      )}
    >
      Drop here to add Day {day}
    </div>
  );
}
