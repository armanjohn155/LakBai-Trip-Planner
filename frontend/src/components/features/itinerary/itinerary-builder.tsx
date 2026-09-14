import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";

import { Link } from "react-router";

import { BudgetSummary } from "@/components/features/itinerary/budget-summary";
import { DeleteIcon } from "@/components/features/itinerary/trip-card";
import { CebuMap } from "@/components/features/map/cebu-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { CheckIcon, GripIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  addItineraryItem,
  apiError,
  deleteItineraryItem,
  getDestinations,
  getItinerary,
  getItinerarySummary,
  updateItinerary,
  updateItineraryItem,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Destination, Itinerary, ItineraryItem, ItinerarySummary } from "@/lib/types";

interface ItineraryBuilderProps {
  itineraryId: number;
  initialAddDestinationId?: number | null;
}

interface EditingState {
  itemId: number;
  day_number: string;
  estimated_budget: string;
  notes: string;
}

export function ItineraryBuilder({ itineraryId, initialAddDestinationId }: ItineraryBuilderProps) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [summary, setSummary] = useState<ItinerarySummary | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);

  const [destinationId, setDestinationId] = useState<string>(initialAddDestinationId ? String(initialAddDestinationId) : "");
  const [dayNumber, setDayNumber] = useState("1");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [updatingItem, setUpdatingItem] = useState<number | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EditingState | null>(null);
  const [addOpen, setAddOpen] = useState<boolean | null>(null);

  const [visitedBusy, setVisitedBusy] = useState<number | null>(null);
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const refresh = useCallback(async () => {
    const [trip, bud, dests] = await Promise.all([
      getItinerary(itineraryId),
      getItinerarySummary(itineraryId),
      getDestinations({ per_page: 100 }),
    ]);
    setItinerary(trip);
    setSummary(bud);
    setDestinations(dests.data);
    setTitle(trip.title);
    setStartDate(trip.start_date ?? "");
    setEndDate(trip.end_date ?? "");
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

  const prevSelected = useMemo(() => destinations.find((d) => String(d.id) === destinationId), [destinations, destinationId]);
  const maxDay = useMemo(() => Math.max(...itinerary?.items?.map((item) => item.day_number) ?? [1], initialAddDestinationId ? 1 : 1), [itinerary, initialAddDestinationId]);

  const groups = useMemo(() => {
    const items = [...(itinerary?.items ?? [])].sort((a, b) => a.day_number - b.day_number || a.order - b.order);
    const result: { day: number; items: ItineraryItem[] }[] = [];
    for (const item of items) {
      const current = result[result.length - 1];
      if (current && current.day === item.day_number) {
        current.items.push(item);
      } else {
        result.push({ day: item.day_number, items: [item] });
      }
    }
    return result;
  }, [itinerary]);

  const selectDestination = useCallback(
    (destination: Destination) => {
      setDestinationId(String(destination.id));
      if (!budget) setBudget(destination.estimated_cost ?? "");
    },
    [budget],
  );

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await addItineraryItem(itineraryId, {
        destination_id: Number(destinationId),
        day_number: Number(dayNumber) || undefined,
        estimated_budget: budget === "" ? null : Number(budget),
        notes: notes === "" ? null : notes,
      });
      setDestinationId("");
      setDayNumber(String(maxDay));
      setBudget("");
      setNotes("");
      await refresh();
    } catch (error) {
      setAddError(apiError(error));
    } finally {
      setAdding(false);
    }
  };

  const handleSaveTrip = async (event: FormEvent) => {
    event.preventDefault();
    setTripError(null);
    setSavingTrip(true);
    try {
      await updateItinerary(itineraryId, {
        title,
        start_date: startDate === "" ? null : startDate,
        end_date: endDate === "" ? null : endDate,
      });
      setEditing(false);
      await refresh();
    } catch (error) {
      setTripError(apiError(error));
    } finally {
      setSavingTrip(false);
    }
  };

  const handleToggleVisited = async (item: ItineraryItem) => {
    setVisitedBusy(item.id);
    setItemError(null);
    try {
      await updateItineraryItem(itineraryId, item.id, { visited: !item.visited });
      await refresh();
    } catch (error) {
      setItemError(apiError(error));
    } finally {
      setVisitedBusy(null);
    }
  };

  const handleUpdateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;
    setItemError(null);
    setUpdatingItem(editingItem.itemId);
    try {
      await updateItineraryItem(itineraryId, editingItem.itemId, {
        day_number: Number(editingItem.day_number),
        estimated_budget: editingItem.estimated_budget === "" ? null : Number(editingItem.estimated_budget),
        notes: editingItem.notes === "" ? null : editingItem.notes,
      });
      setEditingItem(null);
      await refresh();
    } catch (error) {
      setItemError(apiError(error));
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    setItemError(null);
    setUpdatingItem(itemId);
    try {
      await deleteItineraryItem(itineraryId, itemId);
      setEditingItem(null);
      await refresh();
    } catch (error) {
      setItemError(apiError(error));
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleReorder = async (fromId: number, toId: number) => {
    const ordered = [...(itinerary?.items ?? [])].sort((a, b) => a.day_number - b.day_number || a.order - b.order);
    const from = ordered.findIndex((item) => item.id === fromId);
    const to = ordered.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0 || from === to) return;

    const reordered = ordered.filter((item) => item.id !== fromId);
    const dragged = ordered[from];
    reordered.splice(to, 0, dragged);
    dragged.day_number = to === 0 ? (reordered[1]?.day_number ?? dragged.day_number) : reordered[to - 1].day_number;

    let runIndex = 0;
    const patches: { id: number; day_number: number; order: number }[] = [];
    for (let index = 0; index < reordered.length; index++) {
      const current = reordered[index];
      const previous = index === 0 ? null : reordered[index - 1];
      runIndex = previous && previous.day_number === current.day_number ? runIndex + 1 : 0;
      patches.push({ id: current.id, day_number: current.day_number, order: runIndex });
    }

    const changed = patches.filter((patch) => {
      const item = itinerary?.items?.find((candidate) => candidate.id === patch.id);
      return item !== undefined && (item.day_number !== patch.day_number || item.order !== patch.order);
    });
    if (changed.length === 0) return;

    setReordering(true);
    setItemError(null);
    try {
      await Promise.all(
        changed.map((patch) => updateItineraryItem(itineraryId, patch.id, { day_number: patch.day_number, order: patch.order })),
      );
      await refresh();
    } catch (error) {
      setItemError(apiError(error));
    } finally {
      setReordering(false);
    }
  };

  const handleDragStart = (event: DragEvent, itemId: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(itemId));
    setDragItemId(itemId);
  };
  const handleDragOver = (event: DragEvent<HTMLLIElement>, itemId: number) => {
    event.preventDefault();
    if (dragItemId === null || dragItemId === itemId) return;
    setDropTargetId(itemId);
  };
  const handleDrop = (event: DragEvent<HTMLLIElement>, itemId: number) => {
    event.preventDefault();
    if (dragItemId !== null && dragItemId !== itemId) void handleReorder(dragItemId, itemId);
    setDragItemId(null);
    setDropTargetId(null);
  };
  const handleDragEnd = () => {
    setDragItemId(null);
    setDropTargetId(null);
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

  const toggleEditItem = (item: ItineraryItem) =>
    setEditingItem({
      itemId: item.id,
      day_number: String(item.day_number),
      estimated_budget: item.estimated_budget == null ? "" : String(item.estimated_budget),
      notes: item.notes ?? "",
    });

  const addSectionDefaultOpen = initialAddDestinationId != null || (itinerary.items?.length ?? 0) === 0;
  const addSectionOpen = addOpen ?? addSectionDefaultOpen;
  const toggleAdd = () => setAddOpen((value) => !(value ?? addSectionDefaultOpen));

  return (
    <div className="space-y-6 pb-10 sm:pb-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app/trips" className="text-sm font-semibold text-sea-500 hover:text-sea-600">
            ← My trips
          </Link>
          {itinerary.title ? (
            <h1 className="mt-1 font-display text-3xl font-semibold text-lagoon-900">{itinerary.title}</h1>
          ) : null}
        </div>
        <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
          {editing ? "Cancel" : "Edit trip"}
        </Button>
      </div>

      {editing ? (
        <Card className="p-5">
          <form onSubmit={handleSaveTrip} className="grid gap-4 sm:grid-cols-2">
            <Input label="Trip name" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <div />
            <Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Input label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            {tripError ? <p className="text-sm text-red-600 sm:col-span-2">{tripError}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingTrip || !title.trim()}>
                {savingTrip ? "Saving…" : "Save trip"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-5 sm:px-6">
              <h2 className="font-display text-xl font-medium text-lagoon-900">Itinerary</h2>
              <span className="text-sm text-ink-600">{summary.item_count} stops · {summary.day_count} days</span>
            </div>

            {itemError ? <div className="px-5 pb-2 sm:px-6"><InlineError message={itemError} /></div> : null}

            <div className="px-5 pt-1 pb-5 sm:px-6">
              {(itinerary.items?.length ?? 0) === 0 ? (
                <EmptyState title="No stops yet" detail="Use the “+ Add a stop” pill above to start planning your trip." />
              ) : (
                <div className="relative">
                  <div aria-hidden="true" className="absolute bottom-8 top-8 left-[1.375rem] w-px -translate-x-1/2 bg-surf-400" />
                  <ol className="space-y-4">
                    {groups.map((group) => (
                      <li key={`day-${group.day}`} className="relative">
                        <div className="relative flex items-center gap-2.5 pl-11">
                          <span
                            aria-hidden="true"
                            className="absolute left-[1.375rem] h-3 w-3 -translate-x-1/2 rounded-full bg-lagoon-900 ring-4 ring-surf-400/30"
                          />
                          <h3 className="font-display text-base font-semibold text-lagoon-900">Day {group.day}</h3>
                          <p className="text-xs text-ink-600">
                            {group.items.length} {group.items.length === 1 ? "stop" : "stops"}
                          </p>
                        </div>
                        <ul className="mt-3 space-y-3">
                          {group.items.map((item) => (
                            <TimelineRow
                              key={item.id}
                              item={item}
                              editing={editingItem}
                              busy={updatingItem === item.id}
                              visitedBusy={visitedBusy === item.id}
                              reordering={reordering}
                              dragging={dragItemId === item.id}
                              dropTarget={dropTargetId === item.id}
                              onToggleVisited={() => void handleToggleVisited(item)}
                              onEdit={() => toggleEditItem(item)}
                              onChange={setEditingItem}
                              onSave={handleUpdateItem}
                              onCancel={() => setEditingItem(null)}
                              onDelete={() => void handleDeleteItem(item.id)}
                              onDragStart={(event) => handleDragStart(event, item.id)}
                              onDragOver={(event) => handleDragOver(event, item.id)}
                              onDrop={(event) => handleDrop(event, item.id)}
                              onDragEnd={handleDragEnd}
                            />
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </Card>

          <BudgetSummary summary={summary} />
        </div>

        <aside aria-label="Add a stop" className="min-w-0 space-y-3 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleAdd}
              aria-expanded={addSectionOpen}
              className="inline-flex items-center gap-1.5 rounded-full bg-surf-400 px-3.5 py-1.5 text-sm font-semibold text-lagoon-950 transition-colors hover:bg-surf-300"
            >
              <PlusIcon className={cn("h-4 w-4 transition-transform", addSectionOpen && "rotate-45")} />
              Add a stop
            </button>
            <p className="hidden text-sm text-ink-600 sm:block">
              {addSectionOpen ? "Pick a place, then set its day and cost." : "Drag stops to reorder, or add more places."}
            </p>
          </div>

          {addSectionOpen ? (
            <Card className="overflow-hidden">
              <h2 className="px-5 pt-5 font-display text-xl font-medium text-lagoon-900">Add a stop by pin or list</h2>
              <div className="m-5 h-56 overflow-hidden rounded-2xl">
                <CebuMap destinations={destinations} activeId={prevSelected?.id} onSelect={selectDestination} className="h-full w-full" />
              </div>
              <form onSubmit={handleAdd} className="space-y-4 px-5 pb-5">
                <Select
                  name="destination_id"
                  label="Destination"
                  emptyLabel="Pick a place…"
                  required
                  value={destinationId}
                  onChange={(event) => {
                    setDestinationId(event.target.value);
                    const found = destinations.find((d) => String(d.id) === event.target.value);
                    if (found && budget === "") setBudget(found.estimated_cost ?? "");
                  }}
                  options={destinations.map((destination) => ({
                    value: String(destination.id),
                    label: `${destination.name} — ${formatMoney(destination.estimated_cost)}`,
                  }))}
                />
                <div className="space-y-4 rounded-2xl bg-sand-50/70 p-4 ring-1 ring-inset ring-line">
                  <p className="text-sm font-semibold text-ink-900">Stop details</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Day" type="number" min={1} value={dayNumber} onChange={(event) => setDayNumber(event.target.value)} />
                    <Input label="Estimated budget (₱)" type="number" min={0} placeholder="autofill" value={budget} onChange={(event) => setBudget(event.target.value)} />
                  </div>
                  <Input label="Notes (optional)" placeholder="Arrive early, Klook pass…" value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
                {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
                <Button type="submit" disabled={adding || !destinationId}>
                  {adding ? "Adding…" : "Add stop"}
                </Button>
              </form>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

interface TimelineRowProps {
  item: ItineraryItem;
  editing: EditingState | null;
  busy: boolean;
  visitedBusy: boolean;
  reordering: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onToggleVisited: () => void;
  onEdit: () => void;
  onChange: (state: EditingState | null) => void;
  onSave: (event: FormEvent) => void;
  onCancel: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

function TimelineRow({
  item,
  editing,
  busy,
  visitedBusy,
  reordering,
  dragging,
  dropTarget,
  onToggleVisited,
  onEdit,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TimelineRowProps) {
  const isEditing = editing?.itemId === item.id;
  const name = item.destination?.name ?? `Stop #${item.id}`;
  const interactiveDisabled = busy || reordering;

  return (
    <li
      className={cn(
        "group relative rounded-xl bg-white p-3 pl-11 ring-1 ring-inset ring-line transition",
        dropTarget && "ring-2 ring-surf-400",
        dragging && "opacity-40",
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span
        aria-hidden="true"
        className="absolute left-[1.375rem] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surf-500 ring-4 ring-surf-400/25"
      />

      {isEditing ? (
        <form onSubmit={onSave} className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-lg font-semibold text-lagoon-900">{name}</p>
            <p className="text-sm text-ink-600">{item.destination?.region}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Day" type="number" min={1} value={editing.day_number} onChange={(event) => onChange({ ...editing, day_number: event.target.value })} />
            <Input label="Estimated budget (₱)" type="number" min={0} value={editing.estimated_budget} onChange={(event) => onChange({ ...editing, estimated_budget: event.target.value })} />
          </div>
          <Input label="Notes" value={editing.notes} onChange={(event) => onChange({ ...editing, notes: event.target.value })} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <label className="flex shrink-0 cursor-pointer items-center" title={item.visited ? "Marked as visited" : "Mark as visited"}>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={item.visited}
              disabled={visitedBusy || interactiveDisabled}
              onChange={onToggleVisited}
              aria-label={`Mark ${name} as visited`}
            />
            <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-surf-500 bg-white text-white transition-colors peer-checked:bg-surf-500 peer-checked:text-white peer-disabled:opacity-60">
              {item.visited ? <CheckIcon className="h-3.5 w-3.5" /> : <span aria-hidden="true" />}
            </span>
          </label>

          <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left" title={`Edit ${name}`}>
            <span className={cn("block truncate text-sm font-semibold", item.visited ? "text-ink-600/70" : "text-ink-900")}>
              {name}
            </span>
            <span
              className="mt-1.5 block"
              title="Estimated budget — actual-spend tracking is on the roadmap, so this bar is filled as a placeholder."
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-600">Budget</span>
                <span className="text-xs font-semibold text-sea-600">{formatMoney(item.estimated_budget)}</span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sand-100">
                <span className="block h-full rounded-full bg-surf-400" style={{ width: "100%" }} />
              </span>
            </span>
            {item.notes ? <span className="mt-1.5 block truncate text-xs text-ink-600">{item.notes}</span> : null}
          </button>

          <span
            draggable={!interactiveDisabled}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            aria-label={`Reorder ${name}`}
            title="Drag to reorder"
            className={cn(
              "shrink-0 cursor-grab rounded-lg p-1.5 text-ink-500 transition-colors select-none hover:bg-sand-100 hover:text-ink-900 active:cursor-grabbing",
              interactiveDisabled && "cursor-not-allowed opacity-50",
            )}
          >
            <GripIcon className="h-5 w-5" />
          </span>

          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
            title="Remove stop"
            disabled={interactiveDisabled}
            className="shrink-0 rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <DeleteIcon />
          </button>
        </div>
      )}
    </li>
  );
}