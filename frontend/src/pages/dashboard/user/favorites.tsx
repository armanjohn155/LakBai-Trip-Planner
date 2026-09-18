import { useMemo, useState } from "react";

import { Link } from "react-router";

import { SORT_OPTIONS } from "@/components/features/destinations/destination-filters";
import { DestinationGridCard, DestinationListCard } from "@/components/features/destinations/destination-explorer-card";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { GridIcon, HeartIcon, ListIcon, XIcon } from "@/components/icons";
import { Select } from "@/components/ui/input";
import { useAddToTrip } from "@/hooks/use-add-to-trip";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/cn";
import type { Destination, Itinerary, SortBy } from "@/lib/types";

type ViewMode = "grid" | "list";

function compareBy(sortBy: SortBy) {
  return (a: Destination, b: Destination) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    const reviewsA = a.review_count ?? 0;
    const reviewsB = b.review_count ?? 0;
    switch (sortBy) {
      case "rating":
        return ratingB - ratingA || reviewsB - reviewsA;
      case "reviews":
        return reviewsB - reviewsA;
      case "name":
        return a.name.localeCompare(b.name);
      case "popular":
      default:
        return reviewsB - reviewsA || ratingB - ratingA;
    }
  };
}

export default function FavoritesPage() {
  const { favorites, loading, isFavorited, toggle } = useFavorites();
  const { trips, tripsLoading, busyTripId, creating, error, toast, addToTrip, createAndAdd, resetError } = useAddToTrip();
  const [chooserDestination, setChooserDestination] = useState<Destination | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [view, setView] = useState<ViewMode>("grid");

  const sorted = useMemo(() => [...favorites].sort(compareBy(sortBy)), [favorites, sortBy]);

  const handleSelectTrip = async (trip: Itinerary, destination: Destination) => {
    const ok = await addToTrip(trip, destination);
    if (ok) setChooserDestination(null);
  };

  const handleCreateTrip = async (title: string, destination: Destination) => {
    const ok = await createAndAdd(title, destination);
    if (ok) setChooserDestination(null);
  };

  if (loading) {
    return <p className="text-sm text-ink-600">Loading your favorites…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">Favorites</h1>
          <p className="mt-1 text-sm text-ink-600">The spots you always come back to.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-sand-200/70 p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Show favorites as a grid"
              aria-pressed={view === "grid"}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-full transition-colors",
                view === "grid" ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-lagoon-900",
              )}
            >
              <GridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Show favorites as a list"
              aria-pressed={view === "list"}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-full transition-colors",
                view === "list" ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-lagoon-900",
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
          <Select
            className="h-10 w-44"
            aria-label="Sort favorites by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            options={SORT_OPTIONS}
          />
        </div>
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

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-sinulog-magenta">
            <HeartIcon className="h-6 w-6" />
          </span>
          <h3 className="mt-1 font-display text-2xl font-medium text-lagoon-900">No favorites yet</h3>
          <p className="max-w-md text-sm text-ink-600">Tap the heart on any destination and it will land here — no more retyping coordinates.</p>
          <Link
            to="/destinations"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-surf-400 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
          >
            <HeartIcon className="h-4 w-4" />
            Explore destinations
          </Link>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((destination) => (
            <DestinationGridCard
              key={destination.id}
              destination={destination}
              favorited={isFavorited(destination.id)}
              onToggleFavorite={() => {
                void toggle(destination);
              }}
              onAdd={() => {
                resetError();
                setChooserDestination(destination);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((destination) => (
            <DestinationListCard
              key={destination.id}
              destination={destination}
              favorited={isFavorited(destination.id)}
              onToggleFavorite={() => {
                void toggle(destination);
              }}
              onAdd={() => {
                resetError();
                setChooserDestination(destination);
              }}
            />
          ))}
        </div>
      )}

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