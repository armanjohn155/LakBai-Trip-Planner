import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import type { Destination, Itinerary } from "@/lib/types";

interface TripChooserProps {
  destination: Destination;
  trips: Itinerary[];
  tripsLoading: boolean;
  busyTripId: number | null;
  creating: boolean;
  error: string | null;
  onSelect: (trip: Itinerary) => void;
  onCreate: (title: string) => void;
}

export function TripChooser({ destination, trips, tripsLoading, busyTripId, creating, error, onSelect, onCreate }: TripChooserProps) {
  const [newTitle, setNewTitle] = useState("");
  const [showNew, setShowNew] = useState(false);

  if (tripsLoading) {
    return <p className="text-sm text-ink-600">Loading your trips…</p>;
  }

  const startNew = (event: FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    onCreate(newTitle.trim());
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink-900">Add {destination.name} to a trip</p>

      {error ? <InlineError message={error} /> : null}

      {trips.length === 0 ? (
        <p className="text-xs text-ink-600">You have no trips yet — name one to get started.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {trips.map((trip) => (
            <li key={trip.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-sand-100">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{trip.title}</p>
                <p className="text-xs text-ink-600">
                  {trip.item_count ?? 0} stops · {formatMoney(trip.total_budget)}
                </p>
              </div>
              <Button size="sm" disabled={busyTripId === trip.id} onClick={() => onSelect(trip)}>
                {busyTripId === trip.id ? "Adding…" : "Add"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showNew ? (
        <form onSubmit={startNew} className="flex gap-2">
          <Input placeholder="New trip name" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} aria-label="New trip name" />
          <Button type="submit" size="sm" disabled={creating || !newTitle.trim()}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowNew(true)}>
          Start a new trip instead
        </Button>
      )}
    </div>
  );
}