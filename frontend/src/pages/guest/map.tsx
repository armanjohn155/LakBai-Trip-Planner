import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Link, useNavigate, useSearchParams } from "react-router";

import { Header } from "@/components/common/header";
import { Footer } from "@/components/common/footer";
import { CebuMap } from "@/components/features/map/cebu-map";
import { getDestinationFacts } from "@/components/features/destination-detail/destination-facts";
import { InfoCards } from "@/components/features/destination-detail/info-cards";
import { ActivitiesList } from "@/components/features/destination-detail/activities-list";
import { TransportList } from "@/components/features/destination-detail/transport-list";
import { TipsList } from "@/components/features/destination-detail/tips-list";
import { categoryTone, destinationLocation, RatingLine } from "@/components/features/destinations/destination-explorer-card";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { CheckIcon, CrosshairIcon, HeartIcon, PinIcon, PlusIcon, ShareIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { useAddToTrip } from "@/hooks/use-add-to-trip";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { requestRoute, useLiveRoute, type RouteWaypoint } from "@/hooks/use-route";
import { useMediaQuery } from "@/hooks/use-media-query";
import { apiError, getDestinations } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Destination, Itinerary, RouteGeometryResponse } from "@/lib/types";

const SOUTH_CEBU_STOPS = [
  { name: "Cebu City", lat: 10.3157, lng: 123.8854 },
  { name: "Moalboal", lat: 9.95, lng: 123.3833 },
  { name: "Kawasan Falls, Badian", lat: 9.8019444, lng: 123.3738889 },
] satisfies { name: string; lat: number; lng: number }[];

function formatRouteDistance(meters: number): string {
  return `${(meters / 1000).toFixed(meters >= 100_000 ? 0 : 1)} km`;
}

function formatRouteDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours} hr${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}` : `${minutes} min`;
}

function RouteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sky-50 px-2.5 py-2 text-center ring-1 ring-inset ring-sky-100">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-sky-950">{value}</p>
    </div>
  );
}

function SouthCebuRouteCard({
  route,
  routeLoading,
  routeError,
  liveRoute,
  liveRouteLoading,
  liveRouteError,
  livePosition,
  gpsStatus,
  gpsError,
  onStartGps,
  onStopGps,
  targetIndex,
  onTargetChange,
  onRetryRoute,
}: {
  route: RouteGeometryResponse | null;
  routeLoading: boolean;
  routeError: string | null;
  liveRoute: RouteGeometryResponse | null;
  liveRouteLoading: boolean;
  liveRouteError: string | null;
  livePosition: { lat: number; lng: number; accuracy: number | null } | null;
  gpsStatus: string;
  gpsError: string | null;
  onStartGps: () => void;
  onStopGps: () => void;
  targetIndex: number;
  onTargetChange: (value: string) => void;
  onRetryRoute: () => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [collapsed, setCollapsed] = useState(true);
  const showBody = isDesktop || !collapsed;

  return (
    <div className="pointer-events-auto absolute left-3 top-[4.25rem] z-[1000] max-h-[calc(100%-5rem)] w-[min(92%,20rem)] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md sm:left-4 sm:top-[4.5rem] sm:w-80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">South Cebu road trip</p>
          <h2 className="mt-0.5 text-sm font-bold text-lagoon-950">Cebu City → Kawasan Falls</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-sand-100 px-2 py-1 text-[10px] font-semibold text-ink-600">Road route</span>
          {!isDesktop ? (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand route card" : "Collapse route card"}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sand-100 text-ink-700 hover:bg-sand-200"
            >
              <svg viewBox="0 0 24 24" className={cn("h-4 w-4 transition-transform", collapsed ? "" : "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {showBody ? (
        <>
          <div className="mt-3 space-y-2">
            {SOUTH_CEBU_STOPS.slice(0, -1).map((stop, index) => {
              const leg = route?.legs[index];
              return (
                <div key={stop.name} className="rounded-xl border border-line/80 bg-white px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] font-semibold text-ink-900">
                      {stop.name} <span className="font-normal text-ink-500">to {SOUTH_CEBU_STOPS[index + 1].name.split(",")[0]}</span>
                    </p>
                    {leg ? <span className="shrink-0 text-[10px] text-ink-500">Leg {index + 1}</span> : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <RouteMetric label="Distance" value={leg ? formatRouteDistance(leg.distance_m) : routeLoading ? "Routing…" : "—"} />
                    <RouteMetric label="Est. time" value={leg ? formatRouteDuration(leg.duration_s) : routeLoading ? "Routing…" : "—"} />
                  </div>
                </div>
              );
            })}
          </div>

          {route?.approximate ? (
            <p className="mt-2 text-[10px] leading-relaxed text-amber-800">Approximate fallback estimate; road routing is unavailable right now.</p>
          ) : null}
          {routeError ? <p className="mt-2 text-xs text-rose-700">Could not load the road route: {routeError}</p> : null}

          <div className="mt-3 border-t border-line pt-3">
        <label htmlFor="live-route-target" className="block text-[11px] font-semibold text-ink-700">Navigate to</label>
        <div className="mt-1.5 flex gap-2">
          <select
            id="live-route-target"
            value={targetIndex}
            onChange={(event) => onTargetChange(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-xs font-medium text-ink-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value={1}>Moalboal</option>
            <option value={2}>Kawasan Falls, Badian</option>
          </select>
          <button
            type="button"
            onClick={gpsStatus === "active" ? onStopGps : onStartGps}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
          >
            <GpsIcon />
            {gpsStatus === "active" ? "Stop GPS" : gpsStatus === "locating" ? "Locating…" : "Start GPS"}
          </button>
        </div>
        {gpsError ? <p className="mt-1.5 text-[11px] leading-relaxed text-rose-700">{gpsError}</p> : null}
        {gpsStatus === "active" && livePosition ? (
          <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-inset ring-sky-100">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Remaining to {SOUTH_CEBU_STOPS[targetIndex].name.split(",")[0]}</p>
            <p className="mt-0.5 text-xs font-bold text-sky-950">
              {liveRouteLoading ? "Updating route…" : liveRoute ? `${formatRouteDistance(liveRoute.distance_m)} · ${formatRouteDuration(liveRoute.duration_s)}` : "Finding road route…"}
            </p>
            {liveRouteError ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[10px] text-rose-700">Could not update route.</p>
                <button type="button" onClick={onRetryRoute} className="text-[10px] font-semibold text-sky-800 underline">Retry</button>
              </div>
            ) : null}
            {liveRoute?.approximate ? <p className="mt-1 text-[10px] text-amber-800">Approximate route estimate.</p> : null}
          </div>
        ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function GpsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isFavorited, toggle: toggleFavorite } = useFavorites();
  const currentLocation = useCurrentLocation();
  const { trips, tripsLoading, busyTripId, creating, error: chooserError, toast, addToTrip, createAndAdd, resetError } = useAddToTrip();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showChooser, setShowChooser] = useState(false);
  const [copied, setCopied] = useState(false);
  const [southRoute, setSouthRoute] = useState<RouteGeometryResponse | null>(null);
  const [southRouteLoading, setSouthRouteLoading] = useState(true);
  const [southRouteError, setSouthRouteError] = useState<string | null>(null);
  const [routeTargetIndex, setRouteTargetIndex] = useState(2);

  const panelScrollRef = useRef<HTMLDivElement>(null);

  const paramId = (() => {
    const raw = searchParams.get("d");
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) && value > 0 ? value : null;
  })();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
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
    if (destinations.length === 0 || paramId === null) return;
    const match = destinations.find((destination) => destination.id === paramId);
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(match);
      setFocusId(match.id);
    }
  }, [destinations, paramId]);

  const loggedIn = Boolean(user);
  const routeTarget: RouteWaypoint = SOUTH_CEBU_STOPS[routeTargetIndex];
  const liveRoute = useLiveRoute(
    currentLocation.position ? { lat: currentLocation.position.lat, lng: currentLocation.position.lng } : null,
    routeTarget,
    currentLocation.status === "active",
  );

  useEffect(() => {
    const controller = new AbortController();
    requestRoute(SOUTH_CEBU_STOPS.map(({ lat, lng }) => ({ lat, lng })), "driving", controller.signal)
      .then((route) => {
        setSouthRoute(route);
        setSouthRouteError(null);
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setSouthRouteError(apiError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSouthRouteLoading(false);
      });
    return () => controller.abort();
  }, []);

  const handleSelect = (destination: Destination) => {
    setSelected(destination);
    setSearchParams({ d: String(destination.id) }, { replace: true });
  };

  const handleSearchSelect = (destination: Destination) => {
    setSelected(destination);
    setFocusId(destination.id);
    setQuery("");
    setSearchParams({ d: String(destination.id) }, { replace: true });
  };

  const handleClear = () => {
    setSelected(null);
    setFocusId(null);
    setQuery("");
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    panelScrollRef.current?.scrollTo({ top: 0 });
  }, [selected?.id]);

  useEffect(() => {
    if (!selected || window.matchMedia("(min-width: 768px)").matches) return;
    document.getElementById("map-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return destinations
      .filter((destination) => {
        const place = destination.municipality ?? destination.region;
        return (
          destination.name.toLowerCase().includes(normalized) ||
          destination.region.toLowerCase().includes(normalized) ||
          place.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 12);
  }, [destinations, query]);

  const handleSelectTrip = async (trip: Itinerary, destination: Destination) => {
    const ok = await addToTrip(trip, destination);
    if (ok) setShowChooser(false);
  };

  const handleCreateTrip = async (title: string, destination: Destination) => {
    const ok = await createAndAdd(title, destination);
    if (ok) setShowChooser(false);
  };

  const share = async (destination: Destination) => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: destination.name, text: `${destination.name} — ${destination.category}`, url });
      } catch {
        // The user closed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the page URL is still in the address bar.
    }
  };

  const openChooser = () => {
    resetError();
    setShowChooser(true);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex flex-1 flex-col pb-[var(--bottom-nav-h)] md:h-[calc(100dvh-4rem)] md:overflow-hidden md:pb-0">
        {error ? (
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            <InlineError message={error} />
            <Link to="/destinations" className="mt-4 inline-block text-sm font-semibold text-sea-600 transition-colors hover:text-sea-500">
              Browse all destinations
            </Link>
          </div>
        ) : (
          <div className="grid flex-1 md:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] md:overflow-hidden">
            <section id="map-detail-panel" className="order-2 md:order-1 md:h-[calc(100dvh-4rem)]">
              <div className="md:flex md:h-full md:flex-col">
                {selected ? (
                  <>
                    <div ref={panelScrollRef} className="flex-1 overflow-y-auto">
                      <div className="space-y-5 p-4 pb-6 sm:p-6 sm:pb-8">
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

                        <DetailPanelHeader destination={selected} onClear={handleClear} />

                        <PanelPhoto destination={selected} />

                        <InfoCards
                          entranceFee={factsFor(selected).entrance_fee}
                          visitDuration={factsFor(selected).visit_duration}
                          openingHours={factsFor(selected).opening_hours}
                        />

                        <PanelSection title="About">
                          <p className="text-base leading-relaxed text-ink-900">{selected.description}</p>
                        </PanelSection>

                        <PanelSection title="Activities">
                          <ActivitiesList activities={factsFor(selected).activities} />
                        </PanelSection>

                        <PanelSection title="How to Get There">
                          <TransportList options={factsFor(selected).transport} />
                        </PanelSection>

                        <PanelSection title="Travel Tips">
                          <TipsList tips={tipsFor(selected)} />
                        </PanelSection>

                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="secondary" className="h-11" onClick={() => void toggleFavorite(selected)}>
                            <HeartIcon filled={isFavorited(selected.id)} className={cn("h-4 w-4", isFavorited(selected.id) ? "text-mango-400" : "text-sea-500")} />
                            {isFavorited(selected.id) ? "Saved" : "Save"}
                          </Button>
                          <Button variant="secondary" className="h-11" onClick={() => void share(selected)}>
                            {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <ShareIcon className="h-4 w-4" />}
                            {copied ? "Copied" : "Share"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-[var(--bottom-nav-h)] z-10 shrink-0 border-t border-line bg-white px-4 py-3 sm:px-6 md:bottom-0">
                      {loggedIn ? (
                        <Button size="lg" className="w-full" onClick={openChooser}>
                          <PlusIcon className="h-4 w-4" />
                          Add to activity
                        </Button>
                      ) : (
                        <Button size="lg" className="w-full" onClick={() => navigate("/register")}>
                          <PlusIcon className="h-4 w-4" />
                          Sign up to add stops
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <MapPlaceholder />
                )}
              </div>
            </section>

            <section className="relative order-1 md:order-2 md:h-[calc(100dvh-4rem)]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner className="h-6 w-6 text-surf-400" />
                </div>
              ) : (
                <>
                  <div className="relative h-[45dvh] overflow-hidden md:h-full">
                    <CebuMap
                      destinations={destinations}
                      activeId={selected?.id ?? null}
                      focusId={focusId}
                      onSelect={handleSelect}
                      route={southRoute}
                      liveRoute={liveRoute.route}
                      routeStops={SOUTH_CEBU_STOPS}
                      livePosition={currentLocation.status === "active" ? currentLocation.position : null}
                      className="h-full w-full"
                    />
                    <button
                      type="button"
                      onClick={() => currentLocation.start()}
                      aria-label={currentLocation.status === "active" ? "Stop location tracking" : "Use my current location"}
                      className={`absolute left-3 top-3 z-[600] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-sand-50 ${currentLocation.status === "active" ? "text-lagoon-900 bg-lagoon-100" : "text-ink-600"}`}
                    >
                      {currentLocation.status === "active" ? (
                        <PinIcon className="h-5 w-5" />
                      ) : (
                        <CrosshairIcon className="h-5 w-5" />
                      )}
                    </button>
                    {currentLocation.error ? (
                      <div className="absolute right-3 top-3 z-[600] rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-md ring-1 ring-inset ring-rose-100">
                        {currentLocation.error}
                      </div>
                    ) : null}
                  </div>
                  <MapSearchOverlay
                    query={query}
                    onQueryChange={setQuery}
                    matches={matches}
                    onSelect={handleSearchSelect}
                    total={destinations.length}
                  />
                  <SouthCebuRouteCard
                    route={southRoute}
                    routeLoading={southRouteLoading}
                    routeError={southRouteError}
                    liveRoute={liveRoute.route}
                    liveRouteLoading={liveRoute.loading}
                    liveRouteError={liveRoute.error}
                    livePosition={currentLocation.position}
                    gpsStatus={currentLocation.status}
                    gpsError={currentLocation.error}
                    onStartGps={currentLocation.start}
                    onStopGps={currentLocation.stop}
                    targetIndex={routeTargetIndex}
                    onTargetChange={(value) => setRouteTargetIndex(Number(value))}
                    onRetryRoute={liveRoute.retry}
                  />
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer className="pb-[calc(var(--bottom-nav-h)+1rem)] md:pb-0" />

      {showChooser && selected && loggedIn ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={() => setShowChooser(false)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <button
              type="button"
              onClick={() => setShowChooser(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <TripChooser
              destination={selected}
              trips={trips}
              tripsLoading={tripsLoading}
              busyTripId={busyTripId}
              creating={creating}
              error={chooserError}
              onSelect={(trip) => handleSelectTrip(trip, selected)}
              onCreate={(title) => handleCreateTrip(title, selected)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function factsFor(destination: Destination) {
  return getDestinationFacts(destination);
}

function tipsFor(destination: Destination): string[] {
  const facts = getDestinationFacts(destination);
  return [destination.tips, ...facts.extra_tips].filter((tip): tip is string => Boolean(tip));
}

function DetailPanelHeader({ destination, onClear }: { destination: Destination; onClear: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="surf">{destination.category}</Badge>
          <Badge tone="sea">{destination.region}</Badge>
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-tight text-lagoon-900">{destination.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm font-medium text-ink-600">
          <PinIcon className="h-4 w-4 text-sea-600" />
          {destinationLocation(destination)}
        </p>
        <RatingLine destination={destination} className="mt-1.5" />
        <Link to={`/destinations/${destination.id}`} className="mt-3 inline-block text-sm font-semibold text-sea-600 transition-colors hover:text-sea-500">
          View full guide
        </Link>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-line text-ink-600 transition-colors hover:bg-sand-100"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function PanelPhoto({ destination }: { destination: Destination }) {
  const [broken, setBroken] = useState(false);
  if (broken || !destination.image_url) {
    return <div className={cn("h-52 w-full rounded-2xl bg-gradient-to-br", categoryTone(destination.category))} aria-hidden="true" />;
  }
  return (
    <img
      src={destination.image_url}
      alt={`${destination.name} photo`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-52 w-full rounded-2xl object-cover ring-1 ring-line"
    />
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-medium text-lagoon-900">{title}</h2>
      {children}
    </section>
  );
}

function MapPlaceholder() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-8 text-center md:min-h-full">
      <div className="max-w-xs">
        <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8 text-surf-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.1 7-11a7 7 0 10-14 0c0 5.9 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
        <p className="mt-4 font-display text-2xl font-medium text-lagoon-900">Select a destination on the map</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Tap a pin or search above to preview its cost, category, and the best time to visit.
        </p>
      </div>
    </div>
  );
}

interface MapSearchOverlayProps {
  query: string;
  onQueryChange: (value: string) => void;
  matches: Destination[];
  onSelect: (destination: Destination) => void;
  total: number;
}

function MapSearchOverlay({ query, onQueryChange, matches, onSelect, total }: MapSearchOverlayProps) {
  const showList = query.trim().length > 0;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] w-[min(94%,22rem)] -translate-x-1/2">
      <div className="pointer-events-auto relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search location, destination…"
          aria-label="Search destinations on the map"
          className="h-11 w-full rounded-full border-0 bg-white pl-11 pr-4 text-sm text-ink-900 shadow-lg ring-1 ring-inset ring-line placeholder:text-ink-600/70 focus:outline-none focus:ring-2 focus:ring-surf-400"
        />
      </div>

      {showList ? (
        <div className="glass pointer-events-auto mt-2 max-h-72 overflow-y-auto rounded-2xl p-1.5">
          {matches.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-ink-600">
              No matches for “{query.trim()}” across {total} destinations.
            </p>
          ) : (
            matches.map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => onSelect(destination)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-sand-100"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">{destination.name}</span>
                  <span className="block text-xs text-ink-600">
                    {destinationLocation(destination)} · {destination.region}
                  </span>
                </span>
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-sea-600" />
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
