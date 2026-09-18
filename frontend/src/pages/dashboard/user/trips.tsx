import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocation, useNavigate } from "react-router";

import { TripCard, tripStatus } from "@/components/features/itinerary/trip-card";
import { ChevronIcon, PinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { addItineraryItem, apiError, createItinerary, deleteItinerary, getDestinations, getItineraries } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Destination, Itinerary } from "@/lib/types";

type TripSort = "upcoming" | "recent" | "soonest" | "latest";

const TRIP_SORT_OPTIONS: { value: TripSort; label: string }[] = [
  { value: "upcoming", label: "Upcoming first" },
  { value: "recent", label: "Recently edited" },
  { value: "soonest", label: "Trip date (soonest)" },
  { value: "latest", label: "Trip date (latest)" },
];

export default function TripsPage() {
  const navigate = useNavigate();
  const routeState = (useLocation().state as { addDestinationId?: number } | null) ?? {};
  const addDestinationId = routeState.addDestinationId;

  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TripSort>("upcoming");
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [tripList, page] = await Promise.all([getItineraries(), getDestinations({ per_page: 100 })]);
    setTrips(tripList);
    setDestinations(page.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Data is fetched on mount; all state updates happen in promise callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const destinationName = addDestinationId
    ? destinations.find((destination) => destination.id === addDestinationId)?.name ?? "this spot"
    : null;

  const remove = async (itinerary: Itinerary) => {
    if (!window.confirm(`Delete “${itinerary.title}” and all its stops?`)) return;
    try {
      await deleteItinerary(itinerary.id);
      setTrips((current) => current.filter((trip) => trip.id !== itinerary.id));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const duplicate = async (itinerary: Itinerary) => {
    setDuplicatingId(itinerary.id);
    try {
      const copy = await createItinerary({
        title: `${itinerary.title} (Copy)`,
        budget: itinerary.budget ?? null,
        start_date: null,
        end_date: null,
      });
      for (const item of itinerary.items ?? []) {
        await addItineraryItem(copy.id, {
          destination_id: item.destination_id,
          day_number: item.day_number,
          order: item.order,
          estimated_budget: item.estimated_budget == null ? null : Number(item.estimated_budget),
          notes: item.notes,
          visited: item.visited,
        });
      }
      navigate(`/app/trips/${copy.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDuplicatingId(null);
    }
  };

  const sortedTrips = useMemo(() => {
    const list = [...trips];
    switch (sortBy) {
      case "recent":
        return list.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
      case "soonest":
        return list.sort((a, b) => (a.start_date ?? "9999-12-31").localeCompare(b.start_date ?? "9999-12-31"));
      case "latest":
        return list.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
      case "upcoming":
      default: {
        const rank = (trip: Itinerary) => {
          const status = tripStatus(trip);
          if (status === "upcoming") return 0;
          if (status === "in-progress") return 1;
          if (status === "past") return 2;
          return 3;
        };
        return list.sort((a, b) => {
          const byStatus = rank(a) - rank(b);
          if (byStatus !== 0) return byStatus;
          return (a.start_date ?? "9999-12-31").localeCompare(b.start_date ?? "9999-12-31");
        });
      }
    }
  }, [trips, sortBy]);

  if (loading) {
    return <p className="text-sm text-ink-600">Loading your trips…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">My trips</h1>
          <p className="mt-1 text-sm text-ink-600">Every stop, every peso — in one planner.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SortDropdown
            className="h-10 w-48"
            ariaLabel="Sort trips by"
            value={sortBy}
            onChange={setSortBy}
            options={TRIP_SORT_OPTIONS}
          />
          <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}

      {addDestinationId ? (
        <div className="rounded-2xl bg-lagoon-900 p-5 text-sand-50">
          <p className="font-display text-xl font-medium">Add {destinationName} to a trip</p>
          <p className="mt-1 text-sm text-sand-50/70">Pick an existing trip, or start planning a new one.</p>
          {trips.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {trips.map((trip) => (
                <Button
                  key={trip.id}
                  variant="ghost"
                  onClick={() => navigate(`/app/trips/${trip.id}`, { state: { addDestinationId } })}
                >
                  {trip.title}
                </Button>
              ))}
              <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
            </div>
          )}
        </div>
      ) : null}

      {sortedTrips.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-sea-600">
            <PinIcon className="h-6 w-6" />
          </span>
          <h3 className="mt-1 font-display text-2xl font-medium text-lagoon-900">No trips yet</h3>
          <p className="max-w-md text-sm text-ink-600">Start planning your first Cebu adventure.</p>
          <Button size="lg" className="mt-3" onClick={() => navigate("/app/trips/new")}>
            Plan a new trip
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTrips.map((trip) => (
            <TripCard
              key={trip.id}
              itinerary={trip}
              onOpen={() => navigate(`/app/trips/${trip.id}`)}
              onDelete={() => remove(trip)}
              onDuplicate={() => void duplicate(trip)}
              duplicateBusy={duplicatingId === trip.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SortDropdownProps {
  className?: string;
  ariaLabel: string;
  value: TripSort;
  onChange: (value: TripSort) => void;
  options: { value: TripSort; label: string }[];
}

function SortDropdown({ className, ariaLabel, value, onChange, options }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center justify-between gap-2 rounded-xl bg-white/70 px-4 text-sm font-medium text-ink-900 backdrop-blur-sm ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none",
          className,
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronIcon className={cn("h-4 w-4 shrink-0 text-ink-600 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div role="listbox" aria-label={ariaLabel} className="glass-frost absolute right-0 top-full z-50 mt-2 w-48 rounded-xl p-1.5">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                option.value === value ? "bg-white/20 text-lagoon-900" : "text-ink-700 hover:bg-white/15",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}