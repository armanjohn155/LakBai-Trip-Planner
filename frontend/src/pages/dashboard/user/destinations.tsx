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
import { DestinationFilters, EMPTY_EXPLORER_FILTERS } from "@/components/features/destinations/destination-filters";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { GridIcon, ListIcon, SearchIcon, SlidersIcon, XIcon } from "@/components/icons";
import { EmptyState, InlineError } from "@/components/ui/feedback";
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
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpenRef = useRef(false);

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

    const query = filters.search.trim().toLowerCase();

    const filtered = destinations.filter(
      (destination) =>
        (query === "" ||
          destination.name.toLowerCase().includes(query) ||
          (destination.municipality ?? "").toLowerCase().includes(query) ||
          destination.category.toLowerCase().includes(query)) &&
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

  // Close the drawer if the viewport reaches the desktop sidebar breakpoint.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  // Move focus into the drawer on open, and back to the Filters button on close.
  useEffect(() => {
    if (drawerOpen) {
      drawerWasOpenRef.current = true;
      drawerCloseRef.current?.focus();
      return;
    }
    if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false;
      filtersButtonRef.current?.focus();
    }
  }, [drawerOpen]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // Lock page scroll while the drawer is open, restoring it on close or unmount.
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

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
    return <DestinationGridCard key={destination.id} variant="showcase" highlighted={focusedId === destination.id} {...common} />;
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

  return (
    <div className="space-y-8">
      {/* 1. Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-lagoon-900 sm:text-4xl">Destinations</h1>
          <p className="mt-1 text-sm text-ink-600">Every stop, every spot — filter, sort, and pin your favorites.</p>
        </div>

      </div>

      {/* 2. Two-column body */}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* 3. Left sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <DestinationFilters filters={filters} allDestinations={destinations} onFiltersChange={setFilters} />
          </div>
        </aside>

        {/* 4. Right column */}
        <div className="min-w-0 space-y-6">
          {/* 4a. Banner */}
          <FeaturedDestinationsBanner destinations={destinations} onOpen={(destination) => navigate(`/destinations/${destination.id}`)} />

          {error ? <InlineError message={error} /> : null}

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

          {/* 4b. Results header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-lagoon-900 sm:text-2xl">Places to fall in love with</h2>
              <p className="mt-0.5 text-sm text-ink-600">
                Showing <span className="font-semibold text-lagoon-900">{visible.length}</span> of{" "}
                <span className="font-semibold text-lagoon-900">{destinations.length}</span> destinations
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                ref={filtersButtonRef}
                type="button"
                onClick={() => setDrawerOpen((value) => !value)}
                aria-expanded={drawerOpen}
                aria-controls="destination-filters-drawer"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-lagoon-900 lg:hidden"
              >
                <SlidersIcon className="h-4 w-4" />
                Filters
              </button>

              <div className="flex items-center gap-2" role="group" aria-label="View mode">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    view === "grid"
                      ? "border-surf-400 bg-surf-400/10 text-sea-600"
                      : "border-line bg-white text-ink-600 hover:text-lagoon-900",
                  )}
                >
                  <GridIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    view === "list"
                      ? "border-surf-400 bg-surf-400/10 text-sea-600"
                      : "border-line bg-white text-ink-600 hover:text-lagoon-900",
                  )}
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            
        <div className="w-full sm:w-80">
        
          <div className="mt-1.5 flex">
            <input
              id="destination-search"
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search destinations…"
              className="h-11 w-full rounded-l-xl border border-r-0 border-line bg-white px-4 text-sm text-ink-900 placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400"
            />
            <button
              type="button"
              aria-label="Search"
              className="flex h-11 w-12 shrink-0 items-center justify-center rounded-r-xl bg-surf-400 text-white transition-colors hover:bg-surf-300"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
          </div>

          {/* 4c. Results */}
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
            <div className="grid grid-cols-2 gap-2.5 min-[600px]:grid-cols-3">{visible.map(renderCard)}</div>
          ) : (
            <div className="space-y-4">{visible.map(renderCard)}</div>
          )}

          {/* Popular destinations carousel (preserved) */}
          <PopularDestinationsCarousel
            destinations={destinations}
            isFavorited={isFavorited}
            onToggleFavorite={(destination) => void toggleFavorite(destination)}
            onAdd={(destination) => {
              resetError();
              setOpenChooser(destination);
            }}
          />
        </div>
      </div>

      {/* Mobile filters drawer: slides in from the left, 75vw capped at 420px. */}
      <div
        className={cn(
          "fixed inset-0 z-[1200] lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-lagoon-950/50 transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />

        <aside
          id="destination-filters-drawer"
          role="dialog"
          aria-modal={drawerOpen ? true : undefined}
          aria-label="Filters"
          aria-hidden={!drawerOpen}
          inert={!drawerOpen}
          className={cn(
            "absolute inset-y-0 left-0 flex h-dvh w-3/4 max-w-[420px] flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line/60 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-lagoon-900">
              <SlidersIcon className="h-4 w-4 text-sea-600" />
              Filters
            </h2>
            <button
              ref={drawerCloseRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Hide filters"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surf-400"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <DestinationFilters
              filters={filters}
              allDestinations={destinations}
              onFiltersChange={setFilters}
              showHeader={false}
            />
          </div>

          <div className="shrink-0 border-t border-line/60 bg-sand-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilters({ ...EMPTY_EXPLORER_FILTERS })}
                className="h-11 flex-1 rounded-xl border border-line bg-white text-sm font-semibold text-ink-900 transition-colors hover:bg-sand-100"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="h-11 flex-[1.4] rounded-xl bg-surf-400 text-sm font-semibold text-white transition-colors hover:bg-surf-300"
              >
                Show results
              </button>
            </div>
          </div>
        </aside>
      </div>

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