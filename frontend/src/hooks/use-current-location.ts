import { useCallback, useEffect, useRef, useState } from "react";

import { haversineKm } from "@/lib/geo";

const UI_INTERVAL_MS = 2_000;
const MAX_GOOD_ACCURACY_M = 100;
const MIN_MOVEMENT_M = 5;

export type CurrentLocationStatus = "idle" | "locating" | "active" | "denied" | "unavailable" | "timeout" | "insecure";

export interface CurrentLocationPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
}

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };

function errorFor(code: number): { status: CurrentLocationStatus; message: string } {
  if (code === 1) return { status: "denied", message: "Location permission is off. Allow it in your browser site settings, then try again." };
  if (code === 3) return { status: "timeout", message: "Finding your location took too long. Try again somewhere with a clearer view of the sky." };
  return { status: "unavailable", message: "Your location is unavailable right now. Check your device location settings and try again." };
}

export function useCurrentLocation() {
  const [position, setPosition] = useState<CurrentLocationPosition | null>(null);
  const [status, setStatus] = useState<CurrentLocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastPublishedAt = useRef(0);
  const acceptedPosition = useRef<CurrentLocationPosition | null>(null);
  const sentinel = useRef<WakeLockSentinelLike | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    const wakeLock = sentinel.current;
    sentinel.current = null;
    if (wakeLock) void wakeLock.release().catch(() => undefined);
    setStatus("idle");
  }, []);

  const accept = useCallback((fix: GeolocationPosition): CurrentLocationPosition | null => {
    const next: CurrentLocationPosition = {
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      accuracy: Number.isFinite(fix.coords.accuracy) ? fix.coords.accuracy : null,
      heading: Number.isFinite(fix.coords.heading) ? fix.coords.heading : null,
      speed: Number.isFinite(fix.coords.speed) ? fix.coords.speed : null,
      recordedAt: new Date(fix.timestamp || Date.now()).toISOString(),
    };
    const previous = acceptedPosition.current;
    if (previous && (next.accuracy ?? Infinity) > MAX_GOOD_ACCURACY_M && (previous.accuracy ?? Infinity) <= MAX_GOOD_ACCURACY_M) {
      return null;
    }
    if (previous && haversineKm(previous.lat, previous.lng, next.lat, next.lng) * 1000 < MIN_MOVEMENT_M) {
      next.lat = previous.lat;
      next.lng = previous.lng;
    }
    const now = Date.now();
    if (previous && now - lastPublishedAt.current < UI_INTERVAL_MS) return null;
    lastPublishedAt.current = now;
    acceptedPosition.current = next;
    setPosition(next);
    setStatus("active");
    setError(null);
    return next;
  }, []);

  const requestOnce = useCallback((): Promise<CurrentLocationPosition | null> => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStatus("insecure");
      setError("Location only works on HTTPS or localhost.");
      return Promise.resolve(null);
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("This browser does not support location. You can still start the trip without it.");
      return Promise.resolve(null);
    }
    setStatus("locating");
    setError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (fix) => resolve(accept(fix)),
        (geoError) => {
          const failure = errorFor(geoError.code);
          setStatus(failure.status);
          setError(failure.message);
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
    });
  }, [accept]);

  const start = useCallback(() => {
    if (watchId.current !== null) return;
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStatus("insecure");
      setError("Location only works on HTTPS or localhost.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("This browser does not support location.");
      return;
    }
    setStatus("locating");
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (fix) => { accept(fix); },
      (geoError) => {
        const failure = errorFor(geoError.code);
        setStatus(failure.status);
        setError(failure.message);
        if (geoError.code === 1 && watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (wakeLock) {
      void wakeLock.request("screen").then((next) => {
        sentinel.current = next;
      }).catch(() => undefined);
    }
  }, [accept]);

  useEffect(() => stop, [stop]);

  return { position, accuracy: position?.accuracy ?? null, heading: position?.heading ?? null, speed: position?.speed ?? null, status, error, start, stop, requestOnce };
}
