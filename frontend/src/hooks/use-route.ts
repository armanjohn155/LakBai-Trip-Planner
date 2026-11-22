import { useEffect, useMemo, useRef, useState } from "react";

import { apiError, getRoadRoute } from "@/lib/api";
import { haversineKm, profileFallbackSpeedKmh } from "@/lib/geo";
import type { ItineraryItem, RouteGeometryResponse, RouteProfile } from "@/lib/types";

const CLIENT_CACHE_MS = 24 * 60 * 60 * 1000;
const routeCache = new Map<string, { value: RouteGeometryResponse; expiresAt: number }>();

export type RouteWaypoint = { lat: number; lng: number };

export function straightFallback(
  points: RouteWaypoint[],
  reason: RouteGeometryResponse["reason"] = "provider_unavailable",
  profile: RouteProfile = "driving",
): RouteGeometryResponse {
  const speedKmh = profileFallbackSpeedKmh(profile);
  const speedMs = (speedKmh * 1000) / 3600;
  const legs: RouteGeometryResponse["legs"] = [];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]; const b = points[index];
    const lat1 = a.lat * Math.PI / 180; const lat2 = b.lat * Math.PI / 180;
    const dLat = lat2 - lat1; const dLng = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const distance_m = Math.round(6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))));
    legs.push({ distance_m, duration_s: Math.max(1, Math.round(distance_m / speedMs)) });
  }
  return {
    geometry: { type: "LineString", coordinates: points.map(({ lat, lng }) => [lng, lat]) },
    distance_m: legs.reduce((sum, leg) => sum + leg.distance_m, 0),
    duration_s: legs.reduce((sum, leg) => sum + leg.duration_s, 0),
    legs,
    instructions: [],
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
            setRoute(straightFallback(requestPoints, "provider_unavailable", profile));
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

export interface UseLiveRouteOptions {
  profile?: RouteProfile;
  forceRerouteNonce?: number;
}

export function useLiveRoute(
  from: RouteWaypoint | null,
  to: RouteWaypoint | null,
  enabled: boolean,
  options?: UseLiveRouteOptions,
) {
  const profile = options?.profile ?? "driving";
  const forceRerouteNonce = options?.forceRerouteNonce ?? 0;
  const [routedFrom, setRoutedFrom] = useState<RouteWaypoint | null>(null);
  const [routedTo, setRoutedTo] = useState<RouteWaypoint | null>(null);
  const [requestTime, setRequestTime] = useState(0);
  const lastStateRef = useRef<{ point: RouteWaypoint | null; destination: string; profile: string; at: number; nonce: number }>(
    { point: null, destination: "", profile, at: 0, nonce: forceRerouteNonce },
  );
  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;
  const destinationKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : "";

  useEffect(() => {
    if (!enabled || fromLat == null || fromLng == null || toLat == null || toLng == null) {
      lastStateRef.current.point = null;
      lastStateRef.current.destination = "";
      return;
    }
    const currentFrom = { lat: fromLat, lng: fromLng };
    const currentTo = { lat: toLat, lng: toLng };
    const now = Date.now();
    const last = lastStateRef.current;
    const destinationChanged = last.destination !== destinationKey;
    const profileChanged = last.profile !== profile;
    const forceReroute = last.nonce !== forceRerouteNonce;
    const isInitial = last.point === null;

    const publish = (at: number) => {
      lastStateRef.current = { point: currentFrom, destination: destinationKey, profile, at, nonce: forceRerouteNonce };
      setRoutedFrom(currentFrom);
      setRoutedTo(currentTo);
      setRequestTime(at);
    };

    if (isInitial || destinationChanged || profileChanged) {
      publish(now);
      return;
    }

    const schedule = (wait: number) => {
      const timer = window.setTimeout(() => publish(Date.now()), wait);
      return () => window.clearTimeout(timer);
    };

    if (forceReroute) {
      const elapsed = now - last.at;
      if (elapsed >= 10_000) {
        publish(now);
        return;
      }
      return schedule(10_000 - elapsed);
    }

    const lastPoint = last.point;
    if (!lastPoint) return;
    const movedM = haversineKm(lastPoint.lat, lastPoint.lng, currentFrom.lat, currentFrom.lng) * 1000;
    if (movedM < 50) return;
    const elapsed = now - last.at;
    if (elapsed >= 15_000) {
      publish(now);
      return;
    }
    return schedule(15_000 - elapsed);
  }, [enabled, fromLat, fromLng, toLat, toLng, destinationKey, profile, forceRerouteNonce]);

  const result = useRoute({
    from: routedFrom,
    to: routedTo,
    profile,
    enabled: enabled && routedFrom !== null && routedTo !== null,
    retryToken: requestTime,
  });
  return result;
}

/** One road route per day, split into overlapping chunks for days over 25 stops. */
export function usePlannedRoutes(items: ItineraryItem[], enabled: boolean, profile: RouteProfile = "driving") {
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
  const signature = `${profile}:${JSON.stringify(stopsByDay)}`;
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
        const results = await Promise.all(chunks.map((chunk) => requestRoute(chunk, profile, controller.signal)));
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
            const fallback = straightFallback(stops, "provider_unavailable", profile);
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
    // signature captures profile and ordered day/stop coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature]);

  return { routes: enabled ? routes : [], loading: enabled && loading };
}
