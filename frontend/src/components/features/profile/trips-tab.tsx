import { useState } from "react";

import { Link, useNavigate, useOutletContext } from "react-router";

import { TripCard } from "@/components/features/itinerary/trip-card";
import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { apiError, deleteItinerary } from "@/lib/api";
import type { Itinerary } from "@/lib/types";
import type { ProfileTabContext } from "@/pages/dashboard/user/profile";

export function TripsTab() {
  const { trips, tripsLoading, tripsError, refreshTrips } = useOutletContext<ProfileTabContext>();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async (itinerary: Itinerary) => {
    if (!window.confirm(`Delete "${itinerary.title}" and all its stops?`)) return;
    try {
      await deleteItinerary(itinerary.id);
      await refreshTrips();
    } catch (err) {
      setDeleteError(apiError(err));
    }
  };

  if (tripsLoading) {
    return <p className="text-sm text-ink-600">Loading your trips…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">My Trips</h1>
        <p className="mt-1 text-sm text-ink-600">Every stop, every peso — in one planner.</p>
      </div>

      {tripsError || deleteError ? <InlineError message={tripsError ?? deleteError ?? ""} /> : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-600">{trips.length} trip{trips.length === 1 ? "" : "s"} planned</p>
        <Button onClick={() => navigate("/app/trips/new")}>
          <PlusIcon className="h-4 w-4" /> Plan a new trip
        </Button>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          detail="Plan a trip, then pin places from the map to start filling in days and the budget."
          action={<Button onClick={() => navigate("/app/trips/new")}>Plan your first trip</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {trips.map((trip) => (
            <TripCard key={trip.id} itinerary={trip} onOpen={() => navigate(`/app/trips/${trip.id}`)} onDelete={() => void remove(trip)} />
          ))}
        </div>
      )}

      {trips.length > 0 ? (
        <Card className="p-5 text-center">
          <Link to="/app/trips" className="text-sm font-semibold text-sea-600 hover:text-sea-500">
            Manage all trips →
          </Link>
        </Card>
      ) : null}
    </div>
  );
}