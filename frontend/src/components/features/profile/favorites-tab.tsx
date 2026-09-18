import { useState } from "react";

import { Link } from "react-router";

import { DestinationGridCard } from "@/components/features/destinations/destination-explorer-card";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { MapIcon, XIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/feedback";
import { useAddToTrip } from "@/hooks/use-add-to-trip";
import { useFavorites } from "@/hooks/use-favorites";
import type { Destination, Itinerary } from "@/lib/types";

export function FavoritesTab() {
  const { favorites, loading, isFavorited, toggle } = useFavorites();
  const { trips, tripsLoading, busyTripId, creating, error, toast, addToTrip, createAndAdd, resetError } = useAddToTrip();
  const [chooserDestination, setChooserDestination] = useState<Destination | null>(null);

  const handleSelectTrip = async (trip: Itinerary, destination: Destination) => {
    const ok = await addToTrip(trip, destination);
    if (ok) setChooserDestination(null);
  };

  const handleCreateTrip = async (title: string, destination: Destination) => {
    const ok = await createAndAdd(title, destination);
    if (ok) setChooserDestination(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">Saved Destinations</h1>
        <p className="mt-1 text-sm text-ink-600">The spots you always come back to.</p>
      </div>

      {toast ? (
        <div className="rounded-2xl bg-lagoon-900 px-4 py-3 text-sm text-sand-50 shadow-lg">
          {toast.message}{" "}
          {toast.href ? (
            <Link to={toast.href} className="font-semibold text-surf-300 hover:text-surf-400">
              {toast.label}
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-ink-600">Loading your favorites…</p> : null}

      {!loading && favorites.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          detail="Your saved destinations will appear here. Visit Destinations to start saving."
          action={
            <Link
              to="/destinations"
              className="inline-flex items-center gap-2 rounded-full bg-surf-400 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
            >
              <MapIcon className="h-4 w-4" />
              Visit Destinations
            </Link>
          }
        />
      ) : null}

      {!loading && favorites.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((destination) => (
            <DestinationGridCard
              key={destination.id}
              destination={destination}
              favorited={isFavorited(destination.id)}
              onToggleFavorite={() => void toggle(destination)}
              onAdd={() => {
                resetError();
                setChooserDestination(destination);
              }}
            />
          ))}
        </div>
      ) : null}

      {chooserDestination ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={() => setChooserDestination(null)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <button
              type="button"
              onClick={() => setChooserDestination(null)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <TripChooser
              destination={chooserDestination}
              trips={trips}
              tripsLoading={tripsLoading}
              busyTripId={busyTripId}
              creating={creating}
              error={error}
              onSelect={(trip) => handleSelectTrip(trip, chooserDestination)}
              onCreate={(title) => handleCreateTrip(title, chooserDestination)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}