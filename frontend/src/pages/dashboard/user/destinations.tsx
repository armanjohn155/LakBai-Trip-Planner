import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router";

import {
  DestinationGridCard,
  DestinationListCard,
} from "@/components/features/destinations/destination-explorer-card";
import {
  FeaturedDestinationsBanner,
  PopularDestinationsCarousel,
} from "@/components/features/destinations/destinations-highlight-section";
import { DestinationFilters, EMPTY_EXPLORER_FILTERS, SORT_OPTIONS } from "@/components/features/destinations/destination-filters";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { GridIcon, ListIcon, SlidersIcon, XIcon } from "@/components/icons";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { useAddToTrip } from "@/hooks/use-add-to-trip";
import { useFavorites } from "@/hooks/use-favorites";
import { apiError, getDestinations } from "@/lib/api";
import { cn } from "@/lib/cn";
import { toNumber } from "@/lib/format";
import type { Destination, ExplorerFilters, Itinerary, SortBy } from "@/lib/types";

type ViewMode = "grid" | "list";

export default function DestinationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusId = (location.state as { focusId?: number } | null)?.focusId ?? null;

  const { isFavorited, toggle: toggleFavorite } = useFavorites();
  const { trips, tripsLoading, busyTripId, creating, error: chooserError, toast, addToTrip, createAndAdd, resetError } = useAddToTrip();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [filters, setFilters] = useState<ExplorerFilters>(EMPTY_EXPLORER_FILTERS);
  const [view, setView] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(focusId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openChooser, setOpenChooser] = useState<Destination | null>(null);

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getDestinations({ per_page: 100 })
      .then((page) => {
        if (cancelled) return;
        setDestinations(page.data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!focusedId || loading) return;
    const element = cardRefs.current.get(focusedId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedId, loading]);

  const visible = useMemo(() => {
    const matchesPrice = (destination: Destination) => {
      const cost = toNumber(destination.estimated_cost);
      switch (filters.priceTier) {
        case "free":
          return cost === 0;
        case "1":
          return cost >= 1 && cost < 500;
        case "2":
          return cost >= 500 && cost < 1500;
        case "3":
          return cost >= 1500;
        default:
          return true;
      }
    };

    const filtered = destinations.filter(
      (destination) =>
        (filters.categories.length === 0 || filters.categories.includes(destination.category)) &&
        (filters.municipalities.length === 0 || filters.municipalities.includes(destination.municipality ?? "")) &&
        matchesPrice(destination) &&
        (filters.minRating === 0 || (destination.rating ?? 0) >= filters.minRating),
    );

    return [...filtered].sort(compareBy(filters.sortBy));
  }, [destinations, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusedId((current) => (current && !destinations.some((d) => d.id === current) ? null : current));
  }, [destinations]);

  const activeFilterCount =
    filters.categories.length + filters.municipalities.length + (filters.priceTier ? 1 : 0) + (filters.minRating ? 1 : 0);

  const renderCard = (destination: Destination) => {
    const common = {
      destination,
      favorited: isFavorited(destination.id),
      onToggleFavorite: () => {
        void toggleFavorite(destination);
      },
      onAdd: () => {
        resetError();
        setOpenChooser(destination);
      },
      containerRef: (element: HTMLDivElement | null) => {
        if (element) cardRefs.current.set(destination.id, element);
        else cardRefs.current.delete(destination.id);
      },
    };
    if (view === "list") {
      return <DestinationListCard key={destination.id} highlighted={focusedId === destination.id} {...common} />;
    }
    return <DestinationGridCard key={destination.id} highlighted={focusedId === destination.id} {...common} />;
  };

  const handleSelectTrip = async (trip: Itinerary) => {
    if (!openChooser) return;
    const ok = await addToTrip(trip, openChooser);
    if (ok) setOpenChooser(null);
  };

  const handleCreateTrip = async (title: string) => {
    if (!openChooser) return;
    const ok = await createAndAdd(title, openChooser);
    if (ok) setOpenChooser(null);
  };

  if (loading) {
    return <p className="text-sm text-ink-600">Loading destinations…</p>;
  }

  const filtersSidebar = (
    <DestinationFilters filters={filters} allDestinations={destinations} onFiltersChange={setFilters} />
  );

  return (
    <div className="space-y-6">
      <FeaturedDestinationsBanner destinations={destinations} onOpen={(destination) => navigate(`/destinations/${destination.id}`)} />

      

      {error ? <InlineError message={error} /> : null}

      {toast ? (
        <div className="bg-lagoon-900 px-4 py-3 text-sm text-sand-50 shadow-lg">
          {toast.message}{" "}
          {toast.href ? (
            <Link to={toast.href} className="font-semibold text-surf-300 hover:text-surf-400">
              {toast.label}
            </Link>
          ) : null}
        </div>
      ) : null}

     

      <PopularDestinationsCarousel
        destinations={destinations}
        isFavorited={isFavorited}
        onToggleFavorite={(destination) => void toggleFavorite(destination)}
        onAdd={(destination) => {
          resetError();
          setOpenChooser(destination);
        }}
      />

      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">Destinations</h1>
        <p className="mt-1 text-sm text-ink-600">Every stop, every spot — filter, sort, and pin your favorites.</p>
      </div>
      
 <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Showing <span className="font-semibold text-lagoon-900">{visible.length}</span> of{" "}
          <span className="font-semibold text-lagoon-900">{destinations.length}</span> destinations
        </p>

        <div className="flex items-center gap-2">
          <Select
            className="h-10 w-44"
            aria-label="Sort by"
            value={filters.sortBy}
            onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value as SortBy }))}
            options={SORT_OPTIONS}
          />

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-lagoon-900 ring-1 ring-line transition-colors hover:bg-sand-100 lg:hidden"
          >
            <SlidersIcon className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 ? (
               <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surf-400 px-1.5 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <div className="flex items-center rounded-full bg-sand-200/70 p-1" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                view === "grid" ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-lagoon-900",
              )}
            >
              <GridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                view === "list" ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-lagoon-900",
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">{filtersSidebar}</div>
        </aside>

        <div>
          {visible.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              detail="Loosen a filter or two — every destination on the island is waiting."
              action={
                <button
                  type="button"
                  onClick={() => setFilters({ ...EMPTY_EXPLORER_FILTERS })}
                   className="rounded-full bg-surf-400 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
                >
                  Clear all filters
                </button>
              }
            />
          ) : view === "grid" ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map(renderCard)}</div>
          ) : (
            <div className="space-y-4">{visible.map(renderCard)}</div>
          )}
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-sand-50 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-200"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            {filtersSidebar}
          </div>
        </div>
      ) : null}

      {openChooser ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={() => setOpenChooser(null)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <button
              type="button"
              onClick={() => setOpenChooser(null)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <TripChooser
              destination={openChooser}
              trips={trips}
              tripsLoading={tripsLoading}
              busyTripId={busyTripId}
              creating={creating}
              error={chooserError}
              onSelect={handleSelectTrip}
              onCreate={handleCreateTrip}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

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