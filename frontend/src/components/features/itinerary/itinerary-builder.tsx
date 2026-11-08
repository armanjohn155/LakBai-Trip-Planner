import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { AddStopMode } from "@/components/features/itinerary/add-stop-panel";
import { ShareDialog } from "@/components/features/itinerary/share-dialog";
import { StopEditor } from "@/components/features/itinerary/stop-editor";
import { TemplatesDialog } from "@/components/features/itinerary/templates-dialog";
import { TripMapCanvas } from "@/components/features/itinerary/trip-map-canvas";
import { TripPanel, mobileSheetHeight, type MobileSnap } from "@/components/features/itinerary/trip-panel";
import { formatTripDateRange } from "@/components/features/itinerary/itinerary-constants";
import { dayColor } from "@/components/features/map/map-pin";
import {
  ArrowLeftIcon,
  ClockIcon,
  LayersIcon,
  RouteIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-media-query";
import { haversineMeters } from "@/lib/geo";
import {
  apiConflict,
  apiError,
  deleteItineraryItem,
  getDestinations,
  getItinerary,
  getItineraryActivities,
  getItineraryChanges,
  getItineraryRouteEstimates,
  getItinerarySummary,
  reorderItineraryItems,
  updateItinerary,
  updateItineraryItem,
  type ReorderStop,
} from "@/lib/api";
import type {
  Destination,
  Itinerary,
  ItineraryActivity,
  ItineraryItem,
  ItineraryRouteEstimate,
  ItineraryRouteLeg,
  ItinerarySummary,
} from "@/lib/types";

interface ItineraryBuilderProps {
  itineraryId: number;
  initialAddDestinationId?: number | null;
}

interface DayGroup {
  day: number;
  items: ItineraryItem[];
}

function groupByDay(items: ItineraryItem[]): DayGroup[] {
  const sorted = [...items].sort((a, b) => a.day_number - b.day_number || a.order - b.order);
  const groups: DayGroup[] = [];
  for (const item of sorted) {
    const current = groups[groups.length - 1];
    if (current && current.day === item.day_number) current.items.push(item);
    else groups.push({ day: item.day_number, items: [item] });
  }
  return groups;
}

const DAY_COUNT = 30;

export function ItineraryBuilder({ itineraryId, initialAddDestinationId }: ItineraryBuilderProps) {
  const navigate = useNavigate();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const viewportHeight = useViewportHeight();

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [summary, setSummary] = useState<ItinerarySummary | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [estimates, setEstimates] = useState<ItineraryRouteEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);

  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(initialAddDestinationId != null);
  const [addMode, setAddMode] = useState<AddStopMode>("destination");
  const [addDestinationId, setAddDestinationId] = useState(initialAddDestinationId != null ? String(initialAddDestinationId) : "");
  const [addPickedPoint, setAddPickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [remote, setRemote] = useState<{ version: number; updatedBy: string | null; activities: ItineraryActivity[] } | null>(null);
  const [conflict, setConflict] = useState<{ message: string; itinerary: Itinerary } | null>(null);
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const versionRef = useRef(0);

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ point: [number, number]; nonce: number } | null>(null);
  const focusNonceRef = useRef(0);
  const [scrollRequest, setScrollRequest] = useState<{ id: number; nonce: number } | null>(null);
  const scrollNonceRef = useRef(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const [mobileSnap, setMobileSnap] = useState<MobileSnap>("half");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? { delay: 160, tolerance: 8 } : { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = useCallback(async () => {
    const [trip, bud, dests, routes] = await Promise.all([
      getItinerary(itineraryId),
      getItinerarySummary(itineraryId),
      getDestinations({ per_page: 100 }),
      getItineraryRouteEstimates(itineraryId).catch(() => null),
    ]);
    setItinerary(trip);
    setSummary(bud);
    setDestinations(dests.data);
    setEstimates(routes);
  }, [itineraryId]);

  useEffect(() => {
    let cancelled = false;
    // Data is fetched on mount; all state updates happen in promise callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch((error) => {
        if (!cancelled) setLoadError(apiError(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    refresh()
      .catch((error) => setLoadError(apiError(error)))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (itinerary) {
      versionRef.current = itinerary.version ?? 0;
      if (remote && remote.version <= versionRef.current) setRemote(null);
    }
  }, [itinerary, remote]);

  useEffect(() => {
    if (!itinerary || itinerary.trip_type !== "group") return;

    let cancelled = false;
    const check = async () => {
      try {
        const changes = await getItineraryChanges(itineraryId, versionRef.current);
        if (cancelled || !changes.data.changed) return;
        setRemote({
          version: changes.data.version,
          updatedBy: changes.data.updated_by,
          activities: changes.data.activities,
        });
      } catch {
        // Polling is best-effort; the next tick will retry.
      }
    };

    const timer = window.setInterval(() => void check(), 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [itinerary, itineraryId]);

  useEffect(() => {
    if (!activityOpen) return;

    let cancelled = false;
    // Loading flag is set when the activity modal opens; the request follows immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivityLoading(true);
    getItineraryActivities(itineraryId)
      .then((page) => {
        if (!cancelled) setActivities(page.data);
      })
      .catch((error) => {
        if (!cancelled) setItemError(apiError(error));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activityOpen, itineraryId]);

  const items = useMemo(() => itinerary?.items ?? [], [itinerary]);
  const groups = useMemo(() => groupByDay(items), [items]);

  const travelByLeg = useMemo(() => {
    const map = new Map<string, ItineraryRouteLeg>();
    for (const day of estimates?.days ?? []) {
      for (const leg of day.legs) {
        map.set(`${leg.from_stop_id}-${leg.to_stop_id}`, leg);
      }
    }
    return map;
  }, [estimates]);

  const daySummaryByDay = useMemo(
    () => new Map((summary?.days ?? []).map((day) => [day.day_number, day])),
    [summary],
  );

  const totalDistanceM = useMemo(() => {
    if (estimates?.enabled) {
      const distances = estimates.days
        .flatMap((day) => day.legs)
        .map((leg) => leg.distance_m)
        .filter((distance): distance is number => distance !== null);
      if (distances.length > 0) return distances.reduce((total, distance) => total + distance, 0);
    }

    let total = 0;
    let measured = false;
    for (const group of groups) {
      for (let index = 0; index < group.items.length - 1; index += 1) {
        const distance = haversineMeters(group.items[index], group.items[index + 1]);
        if (distance !== null) {
          total += distance;
          measured = true;
        }
      }
    }
    return measured ? total : null;
  }, [estimates, groups]);

  const mobileHeight = mobileSheetHeight(mobileSnap, viewportHeight);
  const panelWidth = isWide ? 400 : 340;

  const mapInsets = useMemo(() => {
    if (isMobile) {
      return { top: 92, right: 16, bottom: mobileHeight + 20, left: 16 };
    }
    return {
      top: 96,
      right: 24,
      bottom: 32,
      left: panelHidden ? 16 : panelWidth + 40,
    };
  }, [isMobile, mobileHeight, panelHidden, panelWidth]);

  const focusItem = useCallback((item: ItineraryItem) => {
    if (item.latitude === null || item.longitude === null) return;
    focusNonceRef.current += 1;
    setFocus({ point: [Number(item.latitude), Number(item.longitude)], nonce: focusNonceRef.current });
  }, []);

  const selectItem = useCallback(
    (item: ItineraryItem) => {
      setSelectedItemId(item.id);
      focusItem(item);
      if (isMobile) {
        setMobileSnap("half");
      } else {
        setPanelHidden(false);
        setPanelCollapsed(false);
      }
      scrollNonceRef.current += 1;
      setScrollRequest({ id: item.id, nonce: scrollNonceRef.current });
    },
    [focusItem, isMobile],
  );

  const applyItinerary = useCallback((next: Itinerary) => {
    setItinerary(next);
  }, []);

  const handleToggleStatus = async (item: ItineraryItem) => {
    setItemError(null);
    setBusyItem(item.id);
    try {
      applyItinerary(
        await updateItineraryItem(itineraryId, item.id, {
          status: item.status === "done" ? "planned" : "done",
          base_version: itinerary?.version,
        }),
      );
      const bud = await getItinerarySummary(itineraryId);
      setSummary(bud);
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    } finally {
      setBusyItem(null);
    }
  };

  const handleDeleteItem = async (item: ItineraryItem) => {
    setItemError(null);
    setBusyItem(item.id);
    try {
      await deleteItineraryItem(itineraryId, item.id, itinerary?.version);
      await refresh();
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    } finally {
      setBusyItem(null);
    }
  };

  const handleReorder = async (nextGroups: DayGroup[]) => {
    const ordered: ItineraryItem[] = nextGroups.flatMap((group) => group.items.map((item) => ({ ...item, day_number: group.day })));

    const stops: ReorderStop[] = [];
    let position = 1;
    let currentDay = ordered[0]?.day_number ?? 1;
    for (const item of ordered) {
      if (item.day_number !== currentDay) {
        currentDay = item.day_number;
        position = 1;
      }
      stops.push({ id: item.id, day_number: item.day_number, order: position });
      position += 1;
    }

    // Optimistic update, then persist; roll back on failure.
    const previous = itinerary;
    if (itinerary) applyItinerary({ ...itinerary, items: ordered });

    try {
      applyItinerary(await reorderItineraryItems(itineraryId, stops, itinerary?.version));
    } catch (error) {
      if (previous) applyItinerary(previous);
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    }
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(Number(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItemId = Number(active.id);
    const overId = String(over.id);

    const sourceGroup = groups.find((group) => group.items.some((item) => item.id === activeItemId));
    if (!sourceGroup) return;

    // Determine the destination day: either a day container ("day-3") or another stop.
    let targetDay: number;
    let targetIndex: number;

    if (overId.startsWith("day-")) {
      targetDay = Number(overId.replace("day-", ""));
      const targetGroup = groups.find((group) => group.day === targetDay);
      targetIndex = targetGroup ? targetGroup.items.length : 0;
    } else {
      const overItem = items.find((item) => item.id === Number(overId));
      if (!overItem) return;
      targetDay = overItem.day_number;
      const targetGroup = groups.find((group) => group.day === targetDay);
      targetIndex = targetGroup ? targetGroup.items.findIndex((item) => item.id === overItem.id) : 0;
    }

    const nextGroups = groups.map((group) => ({ day: group.day, items: [...group.items] }));
    const from = nextGroups.find((group) => group.day === sourceGroup.day);
    if (!from) return;

    const fromIndex = from.items.findIndex((item) => item.id === activeItemId);
    if (fromIndex < 0) return;

    const [moved] = from.items.splice(fromIndex, 1);

    const toGroup = nextGroups.find((group) => group.day === targetDay) ?? { day: targetDay, items: [] };
    if (!nextGroups.some((group) => group.day === targetDay)) nextGroups.push(toGroup);

    const insertAt = Math.max(0, Math.min(targetIndex, toGroup.items.length));
    toGroup.items.splice(insertAt, 0, { ...moved, day_number: targetDay });

    nextGroups.sort((a, b) => a.day - b.day);
    void handleReorder(nextGroups);
  };

  const handleSaveSettings = async (payload: SettingsPayload) => {
    applyItinerary(await updateItinerary(itineraryId, { ...payload, base_version: itinerary?.version }));
    const bud = await getItinerarySummary(itineraryId);
    setSummary(bud);
  };

  const handleLoadLatest = async () => {
    setConflict(null);
    setRemote(null);
    await refresh().catch((error) => setItemError(apiError(error)));
  };

  const handleOpenAdd = useCallback(() => {
    setAddMode("destination");
    setAddDestinationId("");
    setAddPickedPoint(null);
    setAddOpen(true);
    if (isMobile) setMobileSnap("full");
  }, [isMobile]);

  const handleCloseAdd = () => setAddOpen(false);

  const handleAddModeChange = (mode: AddStopMode) => {
    setAddMode(mode);
    if (mode === "destination") setAddPickedPoint(null);
  };

  const handleAddDestinationIdChange = (id: string) => {
    setAddDestinationId(id);
    const destination = destinations.find((entry) => String(entry.id) === id);
    if (destination) {
      focusNonceRef.current += 1;
      setFocus({
        point: [Number(destination.latitude), Number(destination.longitude)],
        nonce: focusNonceRef.current,
      });
      if (isMobile) setMobileSnap("full");
    }
  };

  const handleAddPickedPointChange = (point: { lat: number; lng: number } | null) => {
    setAddPickedPoint(point);
    if (point) {
      focusNonceRef.current += 1;
      setFocus({ point: [point.lat, point.lng], nonce: focusNonceRef.current });
    }
  };

  const handleAdded = async () => {
    setAddDestinationId("");
    setAddPickedPoint(null);
    await refresh();
  };

  if (loading) {
    return <PlannerSkeleton isMobile={isMobile} />;
  }

  if (loadError || !itinerary || !summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-lagoon-950 px-6 text-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="font-display text-xl font-semibold text-lagoon-900">This planner could not be loaded</h2>
          <p className="mt-1 text-sm text-ink-600">
            {loadError ?? "The trip is missing or you no longer have access to it."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={retryLoad}>Try again</Button>
            <Link
              to="/app/trips"
              className="rounded-full px-3 py-2 text-sm font-semibold text-sea-600 hover:bg-sand-100"
            >
              Back to my trips
            </Link>
          </div>
        </div>
        {loadError ? (
          <div className="w-full max-w-md">
            <InlineError message={loadError} />
          </div>
        ) : null}
      </div>
    );
  }

  const dayOptions = Array.from({ length: DAY_COUNT }, (_, index) => index + 1);
  const maxDay = Math.max(summary.day_count || 1, ...groups.map((group) => group.day), 1);
  const activeItem = activeId !== null ? items.find((item) => item.id === activeId) ?? null : null;
  const showEstimates = estimates?.enabled ?? false;
  const canEdit = itinerary.my_role !== "viewer";
  const isOwner = itinerary.my_role === "owner";
  const isGroup = itinerary.trip_type === "group";
  const dateRange = formatTripDateRange(itinerary.start_date, itinerary.end_date);
  const activeDestinationId = addDestinationId === "" ? null : Number(addDestinationId);
  const showDestinationMarkers = addOpen && addMode === "destination";

  const notice = remote ? (
    <div className="rounded-xl bg-mango-400/15 px-3 py-2 ring-1 ring-inset ring-mango-400/30">
      <p className="text-xs text-ink-800">
        <span className="font-semibold">{remote.updatedBy ?? "Someone"}</span> updated this trip while you were looking.
      </p>
      <div className="mt-2 flex gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setActivityOpen(true)}>
          Activity
        </Button>
        <Button size="sm" onClick={() => void handleLoadLatest()}>
          Refresh trip
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="relative h-full w-full overflow-hidden bg-sand-100">
        <TripMapCanvas
          items={items}
          activeItemId={selectedItemId}
          hoveredItemId={hoveredItemId}
          onSelectItem={selectItem}
          onHoverItem={setHoveredItemId}
          focusPoint={focus?.point ?? null}
          focusNonce={focus?.nonce ?? 0}
          pickMode={addOpen && addMode === "custom"}
          pickedPoint={addPickedPoint}
          onPickPoint={(lat, lng) => handleAddPickedPointChange({ lat, lng })}
          destinationMarkers={showDestinationMarkers ? destinations : []}
          activeDestinationId={activeDestinationId}
          onSelectDestination={(destination) => handleAddDestinationIdChange(String(destination.id))}
          onAddDestination={(destination) => handleAddDestinationIdChange(String(destination.id))}
          insets={mapInsets}
          fitKey={`${itinerary.version ?? 0}-${items.length}`}
          bottomInset={isMobile ? mobileHeight : 0}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[880] flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            <Link
              to="/app/trips"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-lagoon-900 shadow-sm ring-1 ring-line/60 backdrop-blur hover:bg-white"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> My trips
            </Link>
            {!isMobile && panelHidden ? (
              <button
                type="button"
                onClick={() => setPanelHidden(false)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-lagoon-900 shadow-lg ring-1 ring-line/60 transition-colors hover:bg-sand-50"
              >
                <LayersIcon className="h-4 w-4" /> Show trip
              </button>
            ) : null}
          </div>

          <div className="pointer-events-auto flex max-w-[min(64vw,26rem)] flex-col items-end gap-1.5">
            <div className="rounded-2xl bg-white/95 px-3.5 py-2 text-right shadow-sm ring-1 ring-line/60 backdrop-blur">
              <h1 className="truncate font-display text-base font-semibold text-lagoon-900">{itinerary.title}</h1>
              <p className="mt-0.5 flex flex-wrap items-center justify-end gap-x-1.5 text-[11px] text-ink-600">
                {dateRange ? <span>{dateRange}</span> : null}
                <span>{summary.day_count} days</span>
                {isGroup && (itinerary.member_count ?? 0) > 0 ? (
                  <span>{itinerary.member_count} travellers</span>
                ) : null}
              </p>
              {groups.length > 0 ? (
                <div className="mt-1 flex flex-wrap justify-end gap-x-2 gap-y-1">
                  {groups.map((group) => (
                    <span key={group.day} className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-600">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: dayColor(group.day) }}
                        aria-hidden="true"
                      />
                      Day {group.day}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {showEstimates ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-ink-600 shadow-sm ring-1 ring-line/60 backdrop-blur">
                <RouteIcon className="h-3.5 w-3.5" /> Route estimates on
              </span>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 z-[900]">
          <TripPanel
            itinerary={itinerary}
            summary={summary}
            groups={groups}
            maxDay={maxDay}
            dayOptions={dayOptions}
            destinations={destinations}
            canEdit={canEdit}
            isOwner={isOwner}
            isGroup={isGroup}
            busyItem={busyItem}
            estimatesEnabled={showEstimates}
            travelByLeg={travelByLeg}
            daySummaryByDay={daySummaryByDay}
            totalDistanceM={totalDistanceM}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            scrollRequest={scrollRequest}
            addOpen={addOpen}
            addMode={addMode}
            addDestinationId={addDestinationId}
            addPickedPoint={addPickedPoint}
            onOpenAdd={handleOpenAdd}
            onCloseAdd={handleCloseAdd}
            onAddModeChange={handleAddModeChange}
            onAddDestinationIdChange={handleAddDestinationIdChange}
            onAddPickedPointChange={handleAddPickedPointChange}
            onAdded={handleAdded}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenTemplates={() => setTemplatesOpen(true)}
            onOpenShare={() => setShareOpen(true)}
            onExportError={setItemError}
            itemError={itemError}
            notice={notice}
            collapsed={panelCollapsed}
            hidden={panelHidden}
            onToggleCollapse={() => setPanelCollapsed((value) => !value)}
            onHide={() => setPanelHidden(true)}
            isMobile={isMobile}
            mobileSnap={mobileSnap}
            mobileHeight={mobileHeight}
            onMobileSnapChange={setMobileSnap}
            onSelectItem={selectItem}
            onHoverItem={setHoveredItemId}
            onToggleStatus={handleToggleStatus}
            onEditItem={setEditingItem}
            onDeleteItem={handleDeleteItem}
            onFocusItem={focusItem}
          />
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="rounded-xl bg-white p-3 opacity-95 shadow-xl ring-1 ring-line/60">
              <p className="text-sm font-semibold text-ink-900">{activeItem.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </div>

      <ShareDialog
        open={shareOpen}
        itinerary={itinerary}
        onClose={() => setShareOpen(false)}
        onChanged={refresh}
        onLeft={() => navigate("/app/trips")}
        onConflict={(fresh) => setConflict({ message: "This trip changed while you were updating it.", itinerary: fresh })}
      />

      <Modal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title="Trip activity"
        description="Who changed what, and when."
        size="md"
      >
        {activityLoading ? (
          <p className="py-6 text-center text-sm text-ink-600">Loading activity...</p>
        ) : activities.length === 0 && remote?.activities.length ? (
          <ActivityList activities={remote.activities} />
        ) : activities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-600">
            No activity yet. Edits, members and sharing changes will show up here.
          </p>
        ) : (
          <ActivityList activities={activities} />
        )}
      </Modal>

      <Modal
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="This trip changed"
        description="Your change was not saved because someone else updated the trip first."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Keep editing
            </Button>
            <Button onClick={() => void handleLoadLatest()}>Load latest version</Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {conflict?.message ?? "Refresh to get the newest stops and settings before trying again."}
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Your unsaved text stays in the editor until you close it, so you can copy it before refreshing.
        </p>
      </Modal>

      <StopEditor
        open={canEdit && editingItem !== null}
        itinerary={itinerary}
        item={editingItem}
        destinations={destinations}
        onClose={() => setEditingItem(null)}
        onSaved={async () => {
          await refresh();
          setEditingItem(null);
        }}
        onConflict={(stale) => setConflict({ message: stale.message, itinerary: stale.itinerary })}
      />

      <SettingsDialog
        open={settingsOpen}
        itinerary={itinerary}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onConflict={(stale) => setConflict({ message: stale.message, itinerary: stale.itinerary })}
      />

      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </DndContext>
  );
}

function PlannerSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-sand-100">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-sand-200 via-sand-100 to-surf-400/30" />
      <div className="absolute left-4 top-4 h-24 w-64 animate-pulse rounded-2xl bg-white/80 shadow-lg" />
      {isMobile ? (
        <div className="absolute inset-x-0 bottom-0 h-[56%] animate-pulse rounded-t-3xl bg-white/90 shadow-2xl" />
      ) : (
        <div className="absolute bottom-4 left-4 top-4 w-[400px] animate-pulse rounded-2xl bg-white/90 shadow-2xl" />
      )}
    </div>
  );
}

const ACTIVITY_LABEL: Record<string, string> = {
  created: "created this trip",
  updated: "updated trip details",
  item_added: "added a stop",
  item_updated: "updated a stop",
  item_removed: "removed a stop",
  items_reordered: "reordered stops",
  member_invited: "invited a traveller",
  member_joined: "joined the trip",
  member_removed: "removed a traveller",
  member_left: "left the trip",
  role_changed: "changed a member role",
  ownership_transferred: "transferred ownership",
  invite_link_created: "created a share link",
  invite_link_revoked: "revoked a share link",
  budget_visibility_changed: "changed budget visibility",
  rsvp_updated: "updated their RSVP",
};

function ActivityList({ activities }: { activities: ItineraryActivity[] }) {
  return (
    <ol className="space-y-1">
      {activities.map((activity) => (
        <li key={activity.id} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-sand-100/60">
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lagoon-900 text-sand-50">
            <ClockIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-800">
              <span className="font-semibold">{activity.user ?? "Someone"}</span>{" "}
              {ACTIVITY_LABEL[activity.action] ?? activity.action.replaceAll("_", " ")}
            </p>
            <p className="text-xs text-ink-500">
              {activity.created_at ? new Date(activity.created_at).toLocaleString() : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface SettingsPayload {
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: string | number | null;
  cover_image_url: string | null;
}

interface SettingsDialogProps {
  open: boolean;
  itinerary: Itinerary;
  onClose: () => void;
  onSave: (payload: SettingsPayload) => Promise<void>;
  onConflict: (conflict: { message: string; itinerary: Itinerary }) => void;
}

function SettingsDialog({ open, itinerary, onClose, onSave, onConflict }: SettingsDialogProps) {
  const [title, setTitle] = useState(itinerary.title);
  const [description, setDescription] = useState(itinerary.description ?? "");
  const [startDate, setStartDate] = useState(itinerary.start_date ?? "");
  const [endDate, setEndDate] = useState(itinerary.end_date ?? "");
  const [budget, setBudget] = useState(itinerary.budget_limit !== null ? String(itinerary.budget_limit) : "");
  const [cover, setCover] = useState(itinerary.cover_image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-seed fields each time the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(itinerary.title);
    setDescription(itinerary.description ?? "");
    setStartDate(itinerary.start_date ?? "");
    setEndDate(itinerary.end_date ?? "");
    setBudget(itinerary.budget_limit !== null ? String(itinerary.budget_limit) : "");
    setCover(itinerary.cover_image_url ?? "");
    setError(null);
  }, [open, itinerary]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description === "" ? null : description,
        start_date: startDate === "" ? null : startDate,
        end_date: endDate === "" ? null : endDate,
        total_budget: budget === "" ? null : Number(budget),
        cover_image_url: cover === "" ? null : cover,
      });
      onClose();
    } catch (saveError) {
      const stale = apiConflict(saveError);
      if (stale) onConflict({ message: stale.message, itinerary: stale.itinerary });
      else setError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={saving} title="Trip settings" description="Rename, date and budget this plan.">
      <form id="trip-settings-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Trip name" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-900">Description</p>
          <textarea
            className="min-h-20 w-full rounded-xl bg-white/70 px-4 py-3 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400"
            value={description}
            maxLength={2000}
            placeholder="What's this trip about?"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="End date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          <Input
            label="Budget limit (₱)"
            type="number"
            min={0}
            placeholder="No limit"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
          <Input label="Cover image URL" value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" />
        </div>
        {error ? <InlineError message={error} /> : null}
      </form>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form="trip-settings-form" disabled={saving || title.trim() === ""}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}
