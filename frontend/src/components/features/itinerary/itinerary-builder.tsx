import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { AddStopCard } from "@/components/features/itinerary/add-stop-panel";
import { BudgetSummary } from "@/components/features/itinerary/budget-summary";
import { ExportMenu } from "@/components/features/itinerary/export-menu";
import { ItineraryMap } from "@/components/features/itinerary/itinerary-map";
import { StopCard } from "@/components/features/itinerary/stop-card";
import { StopEditor } from "@/components/features/itinerary/stop-editor";
import { ShareDialog } from "@/components/features/itinerary/share-dialog";
import { TemplatesDialog } from "@/components/features/itinerary/templates-dialog";
import { formatDuration } from "@/components/features/itinerary/itinerary-constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ClockIcon, LayersIcon, PlusIcon, RouteIcon, ShareIcon, SlidersIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
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
import type { Destination, Itinerary, ItineraryActivity, ItineraryItem, ItineraryRouteEstimate, ItineraryRouteLeg, ItinerarySummary } from "@/lib/types";

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
  const [activeId, setActiveId] = useState<number | null>(null);
  const [focusItemId, setFocusItemId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [remote, setRemote] = useState<{ version: number; updatedBy: string | null; activities: ItineraryActivity[] } | null>(null);
  const [conflict, setConflict] = useState<{ message: string; itinerary: Itinerary } | null>(null);
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const versionRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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

  if (loading) {
    return <p className="text-sm text-ink-600">Loading planner…</p>;
  }

  if (loadError || !itinerary || !summary) {
    return (
      <div className="space-y-4">
        <InlineError message={loadError ?? "This planner could not be loaded."} />
        <Link to="/app/trips" className="text-sm font-semibold text-sea-500 hover:text-sea-600">
          ← Back to my trips
        </Link>
      </div>
    );
  }

  const dayOptions = Array.from({ length: DAY_COUNT }, (_, index) => index + 1);
  const maxDay = Math.max(...groups.map((group) => group.day), 1);
  const activeItem = activeId !== null ? items.find((item) => item.id === activeId) ?? null : null;
  const showEstimates = estimates?.enabled ?? false;
  const canEdit = itinerary.my_role !== "viewer";
  const isOwner = itinerary.my_role === "owner";
  const isGroup = itinerary.trip_type === "group";

  return (
    <div className="space-y-6 pb-10 sm:pb-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/app/trips" className="text-sm font-semibold text-sea-500 hover:text-sea-600">
            ← My trips
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-3xl font-semibold text-lagoon-900">{itinerary.title}</h1>
            {isGroup ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surf-400/15 px-2.5 py-1 text-xs font-semibold text-sea-600">
                <ShareIcon className="h-3.5 w-3.5" /> Group trip
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-sand-200/80 px-2.5 py-1 text-xs font-semibold text-ink-600">
                Solo
              </span>
            )}
            {!canEdit ? (
              <span className="rounded-full bg-mango-400/20 px-2.5 py-1 text-xs font-semibold text-ink-700">View only</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-ink-600">
            {summary.item_count} stops · {summary.day_count} days
            {summary.total_duration_minutes > 0 ? ` · ${formatDuration(summary.total_duration_minutes)} planned` : ""}
            {itinerary.member_count && itinerary.member_count > 1 ? ` · ${itinerary.member_count} travellers` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setActivityOpen(true)}>
            <ClockIcon className="h-4 w-4" /> Activity
          </Button>
          {canEdit ? (
            <Button variant="secondary" onClick={() => setTemplatesOpen(true)}>
              <LayersIcon className="h-4 w-4" /> Templates
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              <SlidersIcon className="h-4 w-4" /> Settings
            </Button>
          ) : null}
          <ExportMenu itinerary={itinerary} onError={setItemError} />
          {itinerary.my_role ? (
            <Button onClick={() => setShareOpen(true)}>
              <ShareIcon className="h-4 w-4" /> {isOwner ? "Share" : "Members"}
            </Button>
          ) : null}
        </div>
      </div>

      {itemError ? <InlineError message={itemError} /> : null}

      {remote ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mango-400/15 px-4 py-3 ring-1 ring-inset ring-mango-400/30">
          <p className="text-sm text-ink-800">
            <span className="font-semibold">{remote.updatedBy ?? "Someone"}</span> updated this trip while you were
            looking. Refresh to see the latest version.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setActivityOpen(true)}>
              View activity
            </Button>
            <Button size="sm" onClick={() => void handleLoadLatest()}>
              Refresh trip
            </Button>
          </div>
        </div>
      ) : null}

      {!canEdit ? (
        <p className="rounded-xl bg-sand-100/70 px-4 py-3 text-sm text-ink-600">
          You have view-only access. You can still explore the map, open stops and export a copy.
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5 sm:px-6">
              <h2 className="font-display text-xl font-medium text-lagoon-900">Itinerary</h2>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setAddOpen((value) => !value)}
                  aria-expanded={addOpen}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surf-400 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
                >
                  <PlusIcon className={cn("h-4 w-4 transition-transform", addOpen && "rotate-45")} />
                  Add a stop
                </button>
              ) : null}
            </div>

            <div className="px-3 pt-1 pb-5 sm:px-4">
              {items.length === 0 ? (
                <div className="px-2">
                  <EmptyState
                    title="No stops yet"
                    detail="Add places from our destinations, or drop a custom stop anywhere in Cebu."
                    action={
                      canEdit ? (
                        <Button onClick={() => setAddOpen(true)}>
                          <PlusIcon className="h-4 w-4" /> Add your first stop
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <div className="space-y-4">
                    {groups.map((group, groupIndex) => (
                      <DayColumn
                        key={group.day}
                        group={group}
                        groups={groups}
                        groupIndex={groupIndex}
                        busyItem={busyItem}
                        estimateEnabled={showEstimates}
                        canEdit={canEdit}
                        travelByLeg={travelByLeg}
                        onToggleStatus={handleToggleStatus}
                        onEdit={setEditingItem}
                        onDelete={handleDeleteItem}
                        onFocus={(id) => setFocusItemId(id)}
                      />
                    ))}
                    <NewDayDrop day={groups.length === 0 ? 1 : groups[groups.length - 1].day + 1} />
                  </div>

                  <DragOverlay>
                    {activeItem ? (
                      <div className="glass rounded-xl p-3 opacity-95 shadow-xl">
                        <p className="text-sm font-semibold text-ink-900">{activeItem.title}</p>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </Card>

          {addOpen && canEdit ? (
            <div>
              <AddStopCard
                itinerary={itinerary}
                destinations={destinations}
                dayOptions={dayOptions}
                defaultDay={maxDay}
                initialDestinationId={initialAddDestinationId}
                onAdded={refresh}
              />
            </div>
          ) : null}

          <BudgetSummary summary={summary} />
        </div>

        <aside aria-label="Trip map" className="min-w-0 space-y-3 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <h2 className="px-5 pt-5 font-display text-xl font-medium text-lagoon-900">Route map</h2>
            {showEstimates ? (
              <p className="px-5 pt-1 text-xs text-ink-600">
                <RouteIcon className="mr-1 inline h-3.5 w-3.5" /> Travel estimates enabled — dashed lines link each day's stops.
              </p>
            ) : null}
            <div className="m-5 h-[26rem] overflow-hidden rounded-2xl">
              {items.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-sand-50 text-sm text-ink-600">
                  Stops will appear here as you add them.
                </div>
              ) : (
                <ItineraryMap
                  items={items}
                  activeItemId={focusItemId}
                  followActive
                  onSelectItem={(item) => (canEdit ? setEditingItem(item) : setFocusItemId(item.id))}
                  className="h-full w-full"
                />
              )}
            </div>
            {destinations.length === 0 ? <p className="px-5 pb-5 text-xs text-ink-600">No destinations loaded.</p> : null}
          </Card>
        </aside>
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
    </div>
  );
}

interface DayColumnProps {
  group: DayGroup;
  groups: DayGroup[];
  groupIndex: number;
  busyItem: number | null;
  estimateEnabled: boolean;
  canEdit: boolean;
  travelByLeg: Map<string, ItineraryRouteLeg>;
  onToggleStatus: (item: ItineraryItem) => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  onFocus: (id: number) => void;
}

function DayColumn({ group, groups, groupIndex, busyItem, estimateEnabled, canEdit, travelByLeg, onToggleStatus, onEdit, onDelete, onFocus }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${group.day}` });
  const ids = group.items.map((item) => item.id);

  // Global sequence numbering across all days.
  const offset = groups.slice(0, groupIndex).reduce((total, current) => total + current.items.length, 0);
  const duration = group.items.reduce((total, item) => total + (item.duration_minutes ?? 0), 0);

  return (
    <section ref={setNodeRef} className={cn("rounded-2xl transition-colors", isOver && "bg-surf-400/10 ring-2 ring-surf-400/40")}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
        <h3 className="font-display text-base font-semibold text-lagoon-900">Day {group.day}</h3>
        <p className="text-xs text-ink-600">
          {group.items.length} {group.items.length === 1 ? "stop" : "stops"}
          {duration > 0 ? ` · ${formatDuration(duration)}` : ""}
        </p>
      </header>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3 px-1">
          {group.items.map((item, itemIndex) => {
            const next = group.items[itemIndex + 1];
            const leg = next ? travelByLeg.get(`${item.id}-${next.id}`) : undefined;
            return (
              <Fragment key={item.id}>
                <StopCard
                  item={item}
                  sequence={offset + itemIndex + 1}
                  busy={busyItem === item.id}
                  canEdit={canEdit}
                  onToggleStatus={() => onToggleStatus(item)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                  onFocus={() => onFocus(item.id)}
                />
                {estimateEnabled && leg && leg.duration_s !== null ? (
                  <li className="px-2 text-[11px] text-ink-500">↓ {formatTravel(leg.distance_m, leg.duration_s)}</li>
                ) : null}
              </Fragment>
            );
          })}
        </ul>
      </SortableContext>
    </section>
  );
}

function NewDayDrop({ day }: { day: number }) {
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

function formatTravel(distanceM: number | null, durationS: number): string {
  const minutes = Math.max(1, Math.round(durationS / 60));
  const km = distanceM !== null ? `${(distanceM / 1000).toFixed(1)} km` : null;
  return km ? `${km} · ~${minutes} min drive` : `~${minutes} min drive`;
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
