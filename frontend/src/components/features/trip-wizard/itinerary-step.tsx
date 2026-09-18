import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { CalendarIcon, GripIcon, PlusIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney, toNumber } from "@/lib/format";
import { draftItemTotal, type DraftItem, type TripDraft } from "@/lib/trip-draft";
import type { Destination } from "@/lib/types";

interface ItineraryStepProps {
  draft: TripDraft;
  dayCount: number;
  destinations: Destination[];
  onAddItem: (destination: Destination, dayIndex: number) => void;
  onUpdateItem: (uid: string, patch: Partial<DraftItem>) => void;
  onRemoveItem: (uid: string) => void;
  onReorderInDay: (dayIndex: number, fromUid: string, toUid: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ItineraryStep({ draft, dayCount, destinations, onAddItem, onUpdateItem, onRemoveItem, onReorderInDay, onBack, onNext }: ItineraryStepProps) {
  const [activeDay, setActiveDay] = useState(1);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [dropTargetUid, setDropTargetUid] = useState<string | null>(null);

  const day = activeDay <= dayCount ? activeDay : 1;
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  const dayItems = useMemo(
    () =>
      draft.items
        .filter((item) => item.dayIndex === day)
        .sort((a, b) => a.order - b.order),
    [draft.items, day],
  );

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? destinations.filter((destination) => destination.name.toLowerCase().includes(query))
      : destinations;
    return base.slice(0, 8);
  }, [destinations, search]);

  const total = draftItemTotal(draft.items);
  const budget = draft.noBudgetLimit || draft.budget === "" ? null : toNumber(draft.budget);
  const diff = budget === null ? null : total - budget;

  const handleDrop = () => {
    if (dragUid && dropTargetUid && dragUid !== dropTargetUid) {
      onReorderInDay(day, dragUid, dropTargetUid);
    }
    setDragUid(null);
    setDropTargetUid(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full bg-surf-400 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
        >
          <PlusIcon className="h-4 w-4" />
          Add a stop
        </button>
        <p className="text-sm text-ink-600">
          {dayCount} {dayCount === 1 ? "day" : "days"} · {draft.items.length} {draft.items.length === 1 ? "stop" : "stops"}
        </p>
      </div>

      {pickerOpen ? (
        <Card className="relative p-4">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search destinations… e.g. Bantayan"
              className="h-10 w-full rounded-xl bg-sand-50 px-4 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:ring-2 focus:ring-surf-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPickerOpen(false);
              }}
              aria-label="Close destination picker"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {matches.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-600">No destinations match “{search}”.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {matches.map((destination) => (
                <li key={destination.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAddItem(destination, day);
                      setSearch("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors hover:bg-sand-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-lagoon-900">{destination.name}</span>
                      <span className="block text-xs text-ink-600">
                        {destination.municipality ?? destination.region} · {destination.category}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-sea-600">{formatMoney(destination.estimated_cost)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-sea-600" />
        {days.map((dayNumber) => (
          <button
            key={dayNumber}
            type="button"
            onClick={() => setActiveDay(dayNumber)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              day === dayNumber ? "bg-lagoon-900 text-sand-50" : "bg-white text-ink-600 ring-1 ring-line hover:bg-sand-100",
            )}
          >
            Day {dayNumber}
          </button>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-medium text-lagoon-900">Day {day}</h2>
          <span className="text-sm text-ink-600">{dayItems.length} {dayItems.length === 1 ? "stop" : "stops"}</span>
        </div>

        {dayItems.length === 0 ? (
          <EmptyState title="Nothing planned yet" detail="Add your first stop for this day — you can reorder stops by dragging them." />
        ) : (
          <ul
            className="divide-y divide-line"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            {dayItems.map((item, index) => {
              const dragging = dragUid === item.uid;
              return (
                <li
                  key={item.uid}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDragUid(item.uid);
                  }}
                  onDragEnd={() => {
                    setDragUid(null);
                    setDropTargetUid(null);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDropTargetUid(item.uid);
                  }}
                  className={cn(
                    "grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_7rem_10rem_4.5rem_auto] sm:items-center",
                    dragging && "opacity-40",
                    dropTargetUid === item.uid && dragUid && dropTargetUid !== dragUid && "opacity-100",
                  )}
                >
                  <span className="flex w-6 items-center justify-center text-ink-600/60">
                    <GripIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-lagoon-900">
                      {index + 1}. {item.destination.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="surf">{item.destination.category}</Badge>
                      <span className="text-xs text-ink-600">{item.destination.municipality ?? item.destination.region}</span>
                    </div>
                  </div>

                  <label className="block text-xs font-semibold text-ink-900 sm:hidden">
                    Budget (₱)
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={item.estimated_budget}
                      onChange={(event) => onUpdateItem(item.uid, { estimated_budget: event.target.value })}
                      className="mt-1 h-9 w-full rounded-lg bg-sand-50 px-2.5 text-sm font-normal text-ink-900 ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none"
                    />
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    aria-label={`Budget for ${item.destination.name}`}
                    value={item.estimated_budget}
                    onChange={(event) => onUpdateItem(item.uid, { estimated_budget: event.target.value })}
                    className="hidden h-9 rounded-lg bg-sand-50 px-2.5 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:ring-2 focus:ring-surf-400 focus:outline-none sm:block"
                  />

                  <label className="block text-xs font-semibold text-ink-900 sm:hidden">
                    Notes
                    <input
                      type="text"
                      placeholder="Arrive early…"
                      value={item.notes}
                      onChange={(event) => onUpdateItem(item.uid, { notes: event.target.value })}
                      className="mt-1 h-9 w-full rounded-lg bg-sand-50 px-2.5 text-sm font-normal text-ink-900 ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none"
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Notes…"
                    aria-label={`Notes for ${item.destination.name}`}
                    value={item.notes}
                    onChange={(event) => onUpdateItem(item.uid, { notes: event.target.value })}
                    className="hidden h-9 rounded-lg bg-sand-50 px-2.5 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:ring-2 focus:ring-surf-400 focus:outline-none sm:block"
                  />

                  <select
                    value={item.dayIndex}
                    onChange={(event) => onUpdateItem(item.uid, { dayIndex: Number(event.target.value) })}
                    aria-label="Move to day"
                    className="h-9 rounded-lg bg-sand-50 px-2 text-sm text-ink-900 ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none"
                  >
                    {days.map((dayNumber) => (
                      <option key={dayNumber} value={dayNumber}>
                        Day {dayNumber}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.uid)}
                    aria-label={`Remove ${item.destination.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-ink-600">Estimated total</p>
          <p className="font-display text-3xl font-semibold text-lagoon-900">{formatMoney(total)}</p>
        </div>
        {budget !== null ? (
          diff === null ? null : diff <= 0 ? (
            <span className="rounded-full bg-emerald-600/10 px-4 py-2 text-sm font-semibold text-emerald-700">
              {diff === 0 ? "On budget" : `${formatMoney(Math.abs(diff))} under a ${formatMoney(budget)} budget`}
            </span>
          ) : (
            <span className="rounded-full bg-red-600/10 px-4 py-2 text-sm font-semibold text-red-700">
              {formatMoney(diff)} over a {formatMoney(budget)} budget
            </span>
          )
        ) : (
          <span className="rounded-full bg-sand-100 px-4 py-2 text-sm font-semibold text-ink-600">No budget limit</span>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button size="lg" onClick={onNext}>
          Next · Review
        </Button>
      </div>
    </div>
  );
}