import { useEffect, useMemo, useRef, useState } from "react";

import { apiError, getRoadRoute } from "@/lib/api";
import type { ItineraryItem, RouteGeometryResponse, RouteProfile } from "@/lib/types";

const CLIENT_CACHE_MS = 24 * 60 * 60 * 1000;
const routeCache = new Map<string, { value: RouteGeometryResponse; expiresAt: number }>();

export type RouteWaypoint = { lat: number; lng: number };

function straightFallback(points: RouteWaypoint[], reason: RouteGeometryResponse["reason"] = "provider_unavailable"): RouteGeometryResponse {
  const legs: RouteGeometryResponse["legs"] = [];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]; const b = points[index];
    const lat1 = a.lat * Math.PI / 180; const lat2 = b.lat * Math.PI / 180;
    const dLat = lat2 - lat1; const dLng = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const distance_m = Math.round(6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))));
    legs.push({ distance_m, duration_s: Math.round(distance_m / (30_000 / 3600)) });
  }
  return {
    geometry: { type: "LineString", coordinates: points.map(({ lat, lng }) => [lng, lat]) },
    distance_m: legs.reduce((sum, leg) => sum + leg.distance_m, 0),
    duration_s: legs.reduce((sum, leg) => sum + leg.duration_s, 0),
    legs,
    provider: "haversine",
    approximate: true,
    reason,
  };
}

function routeKey(waypoints: RouteWaypoint[], profile: RouteProfile): string {
  return `${profile}:${waypoints.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join(";")}`;
}

export async function requestRoute(
  waypoints: RouteWaypoint[],
  profile: RouteProfile,
  signal?: AbortSignal,
): Promise<RouteGeometryResponse> {
  const key = routeKey(waypoints, profile);
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await getRoadRoute(waypoints, profile, signal);
  if (!value.approximate || value.reason === "no_road_route") {
    routeCache.set(key, { value, expiresAt: Date.now() + CLIENT_CACHE_MS });
  }
  return value;
}

export interface UseRouteResult {
  route: RouteGeometryResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useRoute({
  from,
  to,
  profile = "driving",
  enabled,
  debounceMs = 0,
  retryToken = 0,
}: {
  from: RouteWaypoint | null;
  to: RouteWaypoint | null;
  profile?: RouteProfile;
  enabled: boolean;
  debounceMs?: number;
  retryToken?: number;
}): UseRouteResult {
  const [route, setRoute] = useState<RouteGeometryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;
  const requestPoints = useMemo(
    () => fromLat != null && fromLng != null && toLat != null && toLng != null
      ? [{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }]
      : null,
    [fromLat, fromLng, toLat, toLng],
  );

  useEffect(() => {
    if (!enabled || requestPoints === null) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void requestRoute(requestPoints, profile, controller.signal)
        .then((next) => { if (!cancelled) setRoute(next); })
        .catch((reason: unknown) => {
          if (!cancelled && !(reason instanceof DOMException && reason.name === "AbortError")) {
            setRoute(straightFallback(requestPoints));
            setError(apiError(reason));
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, Math.max(0, debounceMs));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, requestPoints, profile, debounceMs, retryToken, attempt]);

  return {
    route: enabled && requestPoints !== null ? route : null,
    loading: enabled && requestPoints !== null && loading,
    error: enabled && requestPoints !== null ? error : null,
    retry: () => setAttempt((value) => value + 1),
  };
}

export interface PlannedRoadRoute {
  day: number;
  coordinates: [number, number][];
  legs: RouteGeometryResponse["legs"];
  approximate: boolean;
  reason?: RouteGeometryResponse["reason"];
}

export function useLiveRoute(from: RouteWaypoint | null, to: RouteWaypoint | null, enabled: boolean) {
  const [routedFrom, setRoutedFrom] = useState<RouteWaypoint | null>(null);
  const [routedTo, setRoutedTo] = useState<RouteWaypoint | null>(null);
  const [requestTime, setRequestTime] = useState(0);
  const lastOriginRef = useRef<{ point: RouteWaypoint | null; destination: string; at: number }>(
    { point: null, destination: "", at: 0 },
  );
  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;
  const destinationKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : "";

  useEffect(() => {
    if (!enabled || fromLat == null || fromLng == null || toLat == null || toLng == null) {
      lastOriginRef.current.point = null;
      lastOriginRef.current.destination = "";
      return;
    }
    const currentFrom = { lat: fromLat, lng: fromLng };
    const currentTo = { lat: toLat, lng: toLng };
    const now = Date.now();
    const moved = lastOriginRef.current.point === null
      ? Number.POSITIVE_INFINITY
      : Math.hypot(
          (currentFrom.lat - lastOriginRef.current.point.lat) * 111_000,
          (currentFrom.lng - lastOriginRef.current.point.lng) * 111_000 * Math.cos(currentFrom.lat * Math.PI / 180),
        );
    const destinationChanged = lastOriginRef.current.destination !== destinationKey;
    if (lastOriginRef.current.point === null || ((destinationChanged || moved >= 50) && now - lastOriginRef.current.at >= 15_000)) {
      lastOriginRef.current.point = currentFrom;
      lastOriginRef.current.destination = destinationKey;
      lastOriginRef.current.at = now;
      setRoutedFrom(currentFrom);
      setRoutedTo(currentTo);
      setRequestTime(now);
      return;
    }
    if (!destinationChanged && moved < 50) return;
    const wait = Math.max(0, 15_000 - (now - lastOriginRef.current.at));
    const timer = window.setTimeout(() => {
      lastOriginRef.current.point = currentFrom;
      lastOriginRef.current.destination = destinationKey;
      lastOriginRef.current.at = Date.now();
      setRoutedFrom(currentFrom);
      setRoutedTo(currentTo);
      setRequestTime(Date.now());
    }, wait);
    return () => window.clearTimeout(timer);
  }, [enabled, fromLat, fromLng, toLat, toLng, destinationKey]);

  const result = useRoute({ from: routedFrom, to: routedTo, enabled: enabled && routedFrom !== null && routedTo !== null, retryToken: requestTime });
  return result;
}

/** One road route per day, split into overlapping chunks for days over 25 stops. */
export function usePlannedRoutes(items: ItineraryItem[], enabled: boolean) {
  const stopsByDay = useMemo(() => {
    const grouped = new Map<number, RouteWaypoint[]>();
    [...items]
      .filter((item) => item.latitude != null && item.longitude != null)
      .sort((a, b) => a.day_number - b.day_number || a.order - b.order)
      .forEach((item) => {
        const stops = grouped.get(item.day_number) ?? [];
        stops.push({ lat: Number(item.latitude), lng: Number(item.longitude) });
        grouped.set(item.day_number, stops);
      });
    return [...grouped.entries()].filter(([, stops]) => stops.length > 1);
  }, [items]);
  const signature = JSON.stringify(stopsByDay);
  const [routes, setRoutes] = useState<PlannedRoadRoute[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || stopsByDay.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void Promise.all(stopsByDay.map(async ([day, stops]) => {
        const chunks: RouteWaypoint[][] = [];
        for (let start = 0; start < stops.length - 1; start += 24) {
          chunks.push(stops.slice(start, Math.min(start + 25, stops.length)));
        }
        const results = await Promise.all(chunks.map((chunk) => requestRoute(chunk, "driving", controller.signal)));
        return {
          day,
          coordinates: results.flatMap((result, index) => result.geometry.coordinates
            .map(([lng, lat]) => [lat, lng] as [number, number])
            .filter((_, pointIndex) => index === 0 || pointIndex > 0)),
          legs: results.flatMap((result) => result.legs),
          approximate: results.some((result) => result.approximate),
          reason: results.find((result) => result.approximate)?.reason,
        } satisfies PlannedRoadRoute;
      })).then((next) => { if (!cancelled) setRoutes(next); })
        .catch(() => {
          if (cancelled) return;
          setRoutes(stopsByDay.map(([day, stops]) => {
            const fallback = straightFallback(stops);
            return {
              day,
              coordinates: fallback.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
              legs: fallback.legs,
              approximate: true,
              reason: "provider_unavailable",
            };
          }));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
    // signature captures the ordered day/stop coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature]);

  return { routes: enabled ? routes : [], loading: enabled && loading };
}
