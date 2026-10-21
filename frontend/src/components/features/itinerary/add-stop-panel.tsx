import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { CUSTOM_STOP_CATEGORIES } from "@/components/features/itinerary/itinerary-constants";
import { ItineraryMap } from "@/components/features/itinerary/itinerary-map";
import { SearchIcon } from "@/components/icons";
import { addItineraryItem, apiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Destination, Itinerary } from "@/lib/types";

interface AddStopCardProps {
  itinerary: Itinerary;
  destinations: Destination[];
  dayOptions: number[];
  defaultDay: number;
  initialDestinationId?: number | null;
  onAdded: () => Promise<void> | void;
}

type Mode = "destination" | "custom";

export function AddStopCard({ itinerary, destinations, dayOptions, defaultDay, initialDestinationId = null, onAdded }: AddStopCardProps) {
  const [mode, setMode] = useState<Mode>("destination");
  const [search, setSearch] = useState("");
  const [destinationId, setDestinationId] = useState<string>(initialDestinationId ? String(initialDestinationId) : "");
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState<string>("Other");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dayNumber, setDayNumber] = useState<string>(String(defaultDay));
  const [budget, setBudget] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => destinations.find((destination) => String(destination.id) === destinationId), [destinations, destinationId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === "") return destinations.slice(0, 40);
    return destinations.filter((destination) => `${destination.name} ${destination.municipality ?? ""}`.toLowerCase().includes(term)).slice(0, 40);
  }, [destinations, search]);

  const selectDestination = (destination: Destination) => {
    setDestinationId(String(destination.id));
    if (budget === "" && destination.estimated_cost) setBudget(String(Number(destination.estimated_cost)));
  };

  const reset = () => {
    setDestinationId("");
    setCustomTitle("");
    setCustomCategory("Other");
    setCoords(null);
    setBudget("");
    setStartTime("");
    setDuration("");
    setNotes("");
    setSearch("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const common = {
        day_number: Number(dayNumber) || undefined,
        start_time: startTime === "" ? null : startTime,
        duration_minutes: duration === "" ? null : Number(duration),
        estimated_budget: budget === "" ? null : Number(budget),
        notes: notes === "" ? null : notes,
      };

      if (mode === "custom") {
        await addItineraryItem(itinerary.id, {
          ...common,
          custom_title: customTitle.trim(),
          custom_latitude: coords?.lat ?? null,
          custom_longitude: coords?.lng ?? null,
          category: customCategory,
        });
      } else {
        if (!destinationId) return;
        await addItineraryItem(itinerary.id, { ...common, destination_id: Number(destinationId) });
      }

      reset();
      await onAdded();
    } catch (submitError) {
      setError(apiError(submitError));
    } finally {
      setAdding(false);
    }
  };

  const canSubmit = mode === "custom" ? customTitle.trim().length > 0 : destinationId !== "";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5">
        <div className="inline-flex rounded-full bg-sand-100 p-0.5 text-sm font-semibold">
          {(["destination", "custom"] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                mode === value ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-ink-900",
              )}
            >
              {value === "destination" ? "From destinations" : "Custom stop"}
            </button>
          ))}
        </div>
      </div>

      {mode === "destination" ? (
        <div className="m-5 mb-0 h-48 overflow-hidden rounded-2xl">
          <ItineraryMap
            items={[]}
            pickedPoint={null}
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="m-5 mb-0 h-48 overflow-hidden rounded-2xl">
          <ItineraryMap items={[]} pickedPoint={coords} onPickPoint={(lat, lng) => setCoords({ lat, lng })} className="h-full w-full" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {mode === "destination" ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-surf-400">
              <SearchIcon className="h-4 w-4 text-ink-500" />
              <input
                className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-600/50 focus:outline-none"
                placeholder="Search destinations…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="max-h-52 overflow-y-auto rounded-xl ring-1 ring-inset ring-line">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-ink-600">No destinations match.</p>
              ) : (
                <ul className="divide-y divide-line/60">
                  {filtered.map((destination) => (
                    <li key={destination.id}>
                      <button
                        type="button"
                        onClick={() => selectDestination(destination)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-sand-50",
                          String(destination.id) === destinationId && "bg-surf-400/10",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-900">{destination.name}</span>
                          <span className="block truncate text-xs text-ink-600">{destination.municipality ?? destination.region}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-sea-600">{formatMoney(destination.estimated_cost)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selected ? <p className="text-xs text-ink-600">Selected: {selected.name}</p> : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Stop name" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Lunch at Carbon Market" required />
            <Select
              label="Category"
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              options={CUSTOM_STOP_CATEGORIES.map((category) => ({ value: category, label: category }))}
            />
            {coords ? (
              <p className="text-xs text-ink-600 sm:col-span-2">
                Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — tap the map to move it.
              </p>
            ) : (
              <p className="text-xs text-ink-600 sm:col-span-2">Tap the map to pin this stop (optional).</p>
            )}
          </div>
        )}

        <div className="space-y-4 rounded-2xl bg-sand-50/70 p-4 ring-1 ring-inset ring-line">
          <p className="text-sm font-semibold text-ink-900">Stop details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Day"
              value={dayNumber}
              onChange={(event) => setDayNumber(event.target.value)}
              options={dayOptions.map((day) => ({ value: String(day), label: `Day ${day}` }))}
            />
            <Input
              label="Estimated budget (₱)"
              type="number"
              min={0}
              placeholder="autofill"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
            <Input label="Start time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            <Input label="Duration (minutes)" type="number" min={5} max={1440} value={duration} onChange={(event) => setDuration(event.target.value)} />
          </div>
          <Input label="Notes (optional)" placeholder="Arrive early, Klook pass…" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        {error ? <InlineError message={error} /> : null}

        <Button type="submit" disabled={adding || !canSubmit}>
          {adding ? "Adding…" : "Add stop"}
        </Button>
      </form>
    </Card>
  );
}
