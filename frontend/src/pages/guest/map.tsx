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
import { requestRoute, straightFallback, useLiveRoute, type RouteWaypoint } from "@/hooks/use-route";
import { useMediaQuery } from "@/hooks/use-media-query";
import { apiError, getDestinations } from "@/lib/api";
import { cn } from "@/lib/cn";
import { haversineKm } from "@/lib/geo";
import type { Destination, Itinerary, RouteGeometryResponse } from "@/lib/types";

import {
  CEBU_CITY_COORDS,
  MapRouteCard,
  PRESET_SOUTH_CEBU,
  type RouteStop,
} from "@/components/features/map/map-route-card";

const MAX_ROUTE_POINTS = 25;

function destinationPoint(destination: Destination): RouteStop | null {
  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: destination.id,
    name: destination.name,
    municipality: destination.municipality,
    lat,
    lng,
  };
}

function samePoint(a: RouteStop, b: RouteStop): boolean {
  return a.name === b.name && a.lat === b.lat && a.lng === b.lng;
}

function isCanceled(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? String(error.name) : "";
  const code = "code" in error ? String(error.code) : "";
  return name === "CanceledError" || name === "AbortError" || code === "ERR_CANCELED";
}

function fallbackReason(error: unknown): "provider_unavailable" | "rate_limited" {
  return apiError(error).toLowerCase().includes("too many") ? "rate_limited" : "provider_unavailable";
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

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isMobile = !isDesktop;
  const fitPadding = useMemo(
    () => isMobile
      ? { top: 72, right: 56, bottom: 8, left: 12 }
      : { top: 96, right: 56, bottom: 16, left: 36 },
    [isMobile],
  );

  // Origin management
  const [originType, setOriginType] = useState<"cebu_city" | "my_location" | "custom">(() => {
    try {
      const saved = window.sessionStorage.getItem("lakbai.map.origin_type");
      if (saved === "my_location" || saved === "cebu_city" || saved === "custom") return saved;
    } catch {
      // sessionStorage unavailable
    }
    return "cebu_city";
  });
  const [customOrigin, setCustomOrigin] = useState<Destination | null>(null);

  // Multi-stop route list
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [activeTargetIndex, setActiveTargetIndex] = useState(1);

  // Dynamic route states
  const [route, setRoute] = useState<RouteGeometryResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeRetryToken, setRouteRetryToken] = useState(0);
  const [missingDestination, setMissingDestination] = useState(false);
  const [highlightedStopIndex, setHighlightedStopIndex] = useState<number | null>(null);
  const [gpsOriginHold, setGpsOriginHold] = useState(0);

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
    if (loading || customOrigin !== null) return;
    try {
      const savedId = Number(window.sessionStorage.getItem("lakbai.map.custom_origin_id"));
      if (savedId > 0) {
        const match = destinations.find((destination) => destination.id === savedId);
        if (match) setCustomOrigin(match);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [loading, destinations, customOrigin]);

  const effectiveOrigin: RouteStop = useMemo(() => {
    if (originType === "my_location" && currentLocation.position) {
      return {
        name: "My location",
        municipality: "Current GPS Location",
        lat: currentLocation.position.lat,
        lng: currentLocation.position.lng,
        isOrigin: true,
      };
    }
    if (originType === "custom" && customOrigin) {
      const point = destinationPoint(customOrigin);
      if (point) return { ...point, isOrigin: true };
    }
    return CEBU_CITY_COORDS;
  }, [originType, currentLocation.position, customOrigin]);

  const originAnchor = useRef<RouteStop>(CEBU_CITY_COORDS);
  const originUpdatedAt = useRef(0);
  const stableOrigin = useMemo(() => {
    const next = effectiveOrigin;
    const previous = originAnchor.current;
    const samePlace = previous.id === next.id && previous.name === next.name;
    const movedM = haversineKm(previous.lat, previous.lng, next.lat, next.lng) * 1000;
    const gpsOrigin = next.name === "My location" && previous.name === "My location";
    if (samePlace && movedM < 50) return previous;
    if (gpsOrigin && Date.now() - originUpdatedAt.current < 15_000) return previous;
    originUpdatedAt.current = Date.now();
    originAnchor.current = next;
    return next;
  }, [effectiveOrigin, gpsOriginHold]);

  useEffect(() => {
    if (originType !== "my_location") return;
    const timer = window.setInterval(() => setGpsOriginHold((value) => value + 1), 15_000);
    return () => window.clearInterval(timer);
  }, [originType]);

  useEffect(() => {
    if (loading || destinations.length === 0) return;
    if (paramId === null) {
      setMissingDestination(false);
      if (selected !== null) {
        setSelected(null);
        setFocusId(null);
      }
      setStops([]);
      return;
    }
    if (selected?.id === paramId) {
      setMissingDestination(false);
      return;
    }
    const match = destinations.find((destination) => destination.id === paramId);
    if (!match) {
      setMissingDestination(true);
      setSelected(null);
      setFocusId(null);
      return;
    }
    setMissingDestination(false);
    setSelected(match);
    setFocusId(match.id);
  }, [destinations, loading, paramId, selected, stops.length]);

  useEffect(() => {
    if (!selected) {
      setStops((prev) => (prev.length > 2 ? prev : prev.length === 0 ? prev : []));
      return;
    }
    const point = destinationPoint(selected);
    setStops((prev) => {
      const onThisTrip = point != null && prev.length > 2 && prev.slice(1).some((stop) => stop.id === point.id || samePoint(stop, point));
      if (onThisTrip) {
        const origin = prev[0];
        if (origin && samePoint(origin, stableOrigin)) return prev;
        return [stableOrigin, ...prev.slice(1)];
      }
      if (!point) return prev.length === 0 ? prev : [];
      const origin = prev[0];
      const current = prev[1];
      if (prev.length === 2 && origin && current && samePoint(origin, stableOrigin) && current.id === point.id && samePoint(current, point)) {
        return prev;
      }
      return [stableOrigin, point];
    });
  }, [selected, stableOrigin]);

  useEffect(() => {
    if (!selected || stops.length <= 2) {
      setActiveTargetIndex(1);
      return;
    }
    const found = stops.findIndex((stop) => stop.id === selected.id);
    if (found > 0) setActiveTargetIndex(found);
  }, [selected, stops]);

  const routeRequest = useMemo(() => {
    const waypoints = stops
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
      .slice(0, MAX_ROUTE_POINTS)
      .map((stop) => ({ lat: stop.lat, lng: stop.lng }));
    return { waypoints };
  }, [stops]);
  const missingCoordinates = selected != null && destinationPoint(selected) == null && routeRequest.waypoints.length < 2;

  useEffect(() => {
    const { waypoints } = routeRequest;
    if (waypoints.length < 2) {
      setRoute(null);
      setRouteLoading(false);
      setRouteError(missingCoordinates ? "This destination has no map coordinates." : null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setRoute(null);
    setRouteLoading(true);
    setRouteError(null);

    const timer = window.setTimeout(() => {
      requestRoute(waypoints, "driving", controller.signal)
        .then((res) => {
          if (cancelled) return;
          setRoute(res);
          setRouteError(null);
        })
        .catch((err: unknown) => {
          if (cancelled || isCanceled(err)) return;
          setRoute(straightFallback(waypoints, fallbackReason(err)));
          setRouteError(apiError(err));
        })
        .finally(() => {
          if (!cancelled) setRouteLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [routeRequest, routeRetryToken, missingCoordinates]);

  const loggedIn = Boolean(user);
  const activeTargetStop: RouteStop | null = stops[activeTargetIndex] ?? stops[stops.length - 1] ?? null;
  const liveTargetPoint: RouteWaypoint | null = activeTargetStop
    ? { lat: activeTargetStop.lat, lng: activeTargetStop.lng }
    : null;

  const liveRoute = useLiveRoute(
    currentLocation.position ? { lat: currentLocation.position.lat, lng: currentLocation.position.lng } : null,
    liveTargetPoint,
    currentLocation.status === "active" && liveTargetPoint !== null,
  );

  const handleSelect = (destination: Destination) => {
    setSelected(destination);
    setFocusId(destination.id);
    setSearchParams({ d: String(destination.id) });
  };

  const handleSearchSelect = (destination: Destination) => {
    setSelected(destination);
    setFocusId(destination.id);
    setQuery("");
    setSearchParams({ d: String(destination.id) });
  };

  const handleClear = () => {
    setSelected(null);
    setFocusId(null);
    setQuery("");
    setStops([]);
    setSearchParams({});
  };

  const handleLoadPreset = () => {
    const resolved = PRESET_SOUTH_CEBU.map((stop, index) => {
      if (index === 0) return { ...stop, isOrigin: true as const };
      const stopName = stop.name.toLowerCase();
      const match = destinations.find((destination) => destination.name.toLowerCase() === stopName)
        ?? destinations.find((destination) => destination.name.toLowerCase().includes(stopName));
      const point = match ? destinationPoint(match) : null;
      return point ?? stop;
    });
    setStops(resolved);
    setActiveTargetIndex(Math.max(1, resolved.length - 1));
    const last = resolved[resolved.length - 1];
    const target = last?.id == null ? null : destinations.find((destination) => destination.id === last.id);
    if (target) {
      setSelected(target);
      setFocusId(target.id);
      setSearchParams({ d: String(target.id) });
    }
  };

  const handleAddStop = (dest: Destination) => {
    const newStop = destinationPoint(dest);
    if (!newStop) {
      setRouteError("This destination has no map coordinates.");
      return;
    }
    setStops((prev) => {
      if (prev.length >= MAX_ROUTE_POINTS) return prev;
      const selectedPoint = selected ? destinationPoint(selected) : null;
      const base = prev.length >= 2 ? prev : [stableOrigin, ...(selectedPoint ? [selectedPoint] : [])];
      if (base.length >= MAX_ROUTE_POINTS) return prev;
      if (base.some((stop) => stop.id === newStop.id)) return base;
      return [...base, newStop];
    });
    setSelected(dest);
    setFocusId(dest.id);
    setSearchParams({ d: String(dest.id) });
  };

  const handleRemoveStop = (index: number) => {
    const next = stops.filter((_, stopIndex) => stopIndex !== index);
    if (next.length <= 1) {
      setStops([]);
      setSelected(null);
      setFocusId(null);
      setSearchParams({});
      return;
    }
    setStops(next);
    const fallback = next[Math.min(index, next.length - 1)];
    const match = fallback?.id == null ? null : destinations.find((destination) => destination.id === fallback.id);
    if (match) {
      setSelected(match);
      setFocusId(match.id);
      setSearchParams({ d: String(match.id) });
    }
  };

  const handleReorderStops = (from: number, to: number) => {
    setStops((prev) => {
      if (from <= 0 || to <= 0 || from >= prev.length || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const handleOriginTypeChange = (type: "cebu_city" | "my_location" | "custom") => {
    setOriginType(type);
    try {
      window.sessionStorage.setItem("lakbai.map.origin_type", type);
    } catch {
      // sessionStorage unavailable
    }
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
                      route={route}
                      liveRoute={originType === "my_location" && stops.length <= 2 ? null : liveRoute.route}
                      fitPadding={fitPadding}
                      routeStops={stops}
                      highlightedStopIndex={highlightedStopIndex}
                      livePosition={currentLocation.status === "active" ? currentLocation.position : null}
                      className="h-full w-full"
                      zoomControlPosition={isMobile ? "topright" : "bottomright"}
                      bottomInset={isMobile ? 120 : 0}
                    />
                    <button
                      type="button"
                      onClick={() => (currentLocation.status === "active" ? currentLocation.stop() : currentLocation.start())}
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
                  <MapRouteCard
                    selectedDestination={selected}
                    destinations={destinations}
                    route={route}
                    routeLoading={routeLoading}
                    routeError={routeError}
                    onRetryRoute={() => setRouteRetryToken((t) => t + 1)}
                    originType={originType}
                    onChangeOriginType={handleOriginTypeChange}
                    customOrigin={customOrigin}
                    onSelectCustomOrigin={(dest) => {
                      setCustomOrigin(dest);
                      if (dest) {
                        setOriginType("custom");
                        try {
                          window.sessionStorage.setItem("lakbai.map.custom_origin_id", String(dest.id));
                        } catch {
                          // sessionStorage unavailable
                        }
                      }
                    }}
                    stops={stops}
                    onAddStop={handleAddStop}
                    onRemoveStop={handleRemoveStop}
                    onReorderStops={handleReorderStops}
                    onHighlightStop={setHighlightedStopIndex}
                    selectionNotice={missingDestination ? "That destination is no longer available." : null}
                    activeTargetIndex={activeTargetIndex}
                    onSelectTargetIndex={(idx) => {
                      setActiveTargetIndex(idx);
                      const targetStop = stops[idx];
                      if (targetStop?.id) {
                        const dest = destinations.find((d) => d.id === targetStop.id);
                        if (dest) {
                          setSelected(dest);
                          setFocusId(dest.id);
                          setSearchParams({ d: String(dest.id) });
                        }
                      }
                    }}
                    onLoadPreset={handleLoadPreset}
                    onClearRoute={handleClear}
                    onAddToTrip={openChooser}
                    gpsStatus={currentLocation.status}
                    gpsError={currentLocation.error}
                    onStartGps={currentLocation.start}
                    onStopGps={currentLocation.stop}
                    liveRoute={liveRoute.route}
                    liveRouteLoading={liveRoute.loading}
                    liveRouteError={liveRoute.error}
                    onRetryLiveRoute={liveRoute.retry}
                    livePosition={currentLocation.position}
                    isMobile={isMobile}
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
