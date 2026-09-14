import { useCallback, useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router";

import { TripCard } from "@/components/features/itinerary/trip-card";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { apiError, deleteItinerary, getDestinations, getItineraries } from "@/lib/api";
import type { Destination, Itinerary } from "@/lib/types";

export default function TripsPage() {
  const navigate = useNavigate();
  const routeState = (useLocation().state as { addDestinationId?: number } | null) ?? {};
  const addDestinationId = routeState.addDestinationId;

  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
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

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          detail="Plan a trip, then pin places from the map to start filling in days and the budget."
          action={<Button onClick={() => navigate("/app/trips/new")}>Plan your first trip</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} itinerary={trip} onOpen={() => navigate(`/app/trips/${trip.id}`)} onDelete={() => remove(trip)} />
          ))}
        </div>
      )}
    </div>
  );
}