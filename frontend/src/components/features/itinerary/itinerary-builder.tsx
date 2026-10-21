import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Link } from "react-router";
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
import { TemplatesDialog } from "@/components/features/itinerary/templates-dialog";
import { formatDuration } from "@/components/features/itinerary/itinerary-constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LayersIcon, PlusIcon, RouteIcon, SlidersIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  apiError,
  deleteItineraryItem,
  getDestinations,
  getItinerary,
  getItineraryRouteEstimates,
  getItinerarySummary,
  reorderItineraryItems,
  updateItinerary,
  updateItineraryItem,
  type ReorderStop,
} from "@/lib/api";
import type { Destination, Itinerary, ItineraryItem, ItineraryRouteEstimate, ItineraryRouteLeg, ItinerarySummary } from "@/lib/types";

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
      applyItinerary(await updateItineraryItem(itineraryId, item.id, { status: item.status === "done" ? "planned" : "done" }));
      const bud = await getItinerarySummary(itineraryId);
      setSummary(bud);
    } catch (error) {
      setItemError(apiError(error));
    } finally {
      setBusyItem(null);
    }
  };

  const handleDeleteItem = async (item: ItineraryItem) => {
    setItemError(null);
    setBusyItem(item.id);
    try {
      await deleteItineraryItem(itineraryId, item.id);
      await refresh();
    } catch (error) {
      setItemError(apiError(error));
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
      applyItinerary(await reorderItineraryItems(itineraryId, stops));
    } catch (error) {
      if (previous) applyItinerary(previous);
      setItemError(apiError(error));
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
    applyItinerary(await updateItinerary(itineraryId, payload));
    const bud = await getItinerarySummary(itineraryId);
    setSummary(bud);
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

  return (
    <div className="space-y-6 pb-10 sm:pb-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/app/trips" className="text-sm font-semibold text-sea-500 hover:text-sea-600">
            ← My trips
          </Link>
          <h1 className="mt-1 truncate font-display text-3xl font-semibold text-lagoon-900">{itinerary.title}</h1>
          <p className="mt-0.5 text-sm text-ink-600">
            {summary.item_count} stops · {summary.day_count} days
            {summary.total_duration_minutes > 0 ? ` · ${formatDuration(summary.total_duration_minutes)} planned` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setTemplatesOpen(true)}>
            <LayersIcon className="h-4 w-4" /> Templates
          </Button>
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <SlidersIcon className="h-4 w-4" /> Settings
          </Button>
          <ExportMenu itinerary={itinerary} onError={setItemError} />
        </div>
      </div>

      {itemError ? <InlineError message={itemError} /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5 sm:px-6">
              <h2 className="font-display text-xl font-medium text-lagoon-900">Itinerary</h2>
              <button
                type="button"
                onClick={() => setAddOpen((value) => !value)}
                aria-expanded={addOpen}
                className="inline-flex items-center gap-1.5 rounded-full bg-surf-400 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
              >
                <PlusIcon className={cn("h-4 w-4 transition-transform", addOpen && "rotate-45")} />
                Add a stop
              </button>
            </div>

            <div className="px-3 pt-1 pb-5 sm:px-4">
              {items.length === 0 ? (
                <div className="px-2">
                  <EmptyState
                    title="No stops yet"
                    detail="Add places from our destinations, or drop a custom stop anywhere in Cebu."
                    action={
                      <Button onClick={() => setAddOpen(true)}>
                        <PlusIcon className="h-4 w-4" /> Add your first stop
                      </Button>
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

          {addOpen ? (
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
                  onSelectItem={(item) => setEditingItem(item)}
                  className="h-full w-full"
                />
              )}
            </div>
            {destinations.length === 0 ? <p className="px-5 pb-5 text-xs text-ink-600">No destinations loaded.</p> : null}
          </Card>
        </aside>
      </div>

      <StopEditor
        open={editingItem !== null}
        itinerary={itinerary}
        item={editingItem}
        destinations={destinations}
        onClose={() => setEditingItem(null)}
        onSaved={async () => {
          await refresh();
          setEditingItem(null);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        itinerary={itinerary}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
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
  travelByLeg: Map<string, ItineraryRouteLeg>;
  onToggleStatus: (item: ItineraryItem) => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  onFocus: (id: number) => void;
}

function DayColumn({ group, groups, groupIndex, busyItem, estimateEnabled, travelByLeg, onToggleStatus, onEdit, onDelete, onFocus }: DayColumnProps) {
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
}

function SettingsDialog({ open, itinerary, onClose, onSave }: SettingsDialogProps) {
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
      setError(apiError(saveError));
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
