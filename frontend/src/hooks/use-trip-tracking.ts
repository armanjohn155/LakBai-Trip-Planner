import { useCallback, useEffect, useRef, useState } from "react";

import { sendTrackingPoints } from "@/lib/api";
import { haversineKm } from "@/lib/geo";
import type { TrackingBatchResult, TrackingPointPayload } from "@/lib/types";

const LOCAL_THROTTLE_MS = 5_000;
const UPLOAD_INTERVAL_MS = 12_000;
const MAX_BATCH = 50;
const MIN_FORMAT_DISTANCE_M = 5;

export interface LivePosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading?: number | null;
  speed?: number | null;
  recordedAt: string;
}

interface UseTripTrackingOptions {
  itineraryId: number;
  enabled: boolean;
  onUploaded?: (result: TrackingBatchResult) => void;
}

type QueuedPoint = TrackingPointPayload;

function storageKey(itineraryId: number): string {
  return `suroy.trackingQueue.${itineraryId}`;
}

function readQueue(itineraryId: number): QueuedPoint[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(itineraryId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is QueuedPoint => {
      if (typeof entry !== "object" || entry === null) return false;
      const point = entry as Partial<QueuedPoint>;
      return (
        typeof point.lat === "number" &&
        typeof point.lng === "number" &&
        typeof point.recorded_at === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeQueue(itineraryId: number, queue: QueuedPoint[]): void {
  try {
    if (queue.length === 0) {
      window.sessionStorage.removeItem(storageKey(itineraryId));
      return;
    }
    window.sessionStorage.setItem(storageKey(itineraryId), JSON.stringify(queue.slice(-500)));
  } catch {
    // Private-mode storage failures must not break live tracking.
  }
}

function geolocationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Enable it in your browser to track this trip.";
  }
  if (error.code === error.TIMEOUT) {
    return "Getting your location timed out. Move somewhere with a clearer view of the sky.";
  }
  return "Your location is unavailable right now. Tracking will resume when the GPS finds you.";
}

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * Watches the device GPS while a solo trip is active.
 *
 * Fixes are throttled locally to one every 5 seconds, queued in memory and
 * sessionStorage, then uploaded in batches of up to 50 every 12 seconds. The
 * server still filters accuracy, age and impossible jumps, so this hook never
 * needs to decide whether a position is trustworthy.
 */
export function useTripTracking({ itineraryId, enabled, onUploaded }: UseTripTrackingOptions) {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [traveled, setTraveled] = useState<LivePosition[]>([]);
  const [watching, setWatching] = useState(false);
  const [supported] = useState(() => typeof navigator !== "undefined" && "geolocation" in navigator);
  const [message, setMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");
  const [wakeLockState, setWakeLockState] = useState<"inactive" | "active" | "unsupported" | "denied">("inactive");
  const [pendingCount, setPendingCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const positionRef = useRef<LivePosition | null>(null);
  const queueRef = useRef<QueuedPoint[]>([]);
  const lastFixAtRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const lastQueuedAtRef = useRef(0);
  const lastPolylineRef = useRef<{ lat: number; lng: number } | null>(null);
  const uploadTimerRef = useRef<number | null>(null);
  const flushingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const itineraryRef = useRef(itineraryId);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const onUploadedRef = useRef(onUploaded);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    itineraryRef.current = itineraryId;
  }, [itineraryId]);

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const persist = useCallback(() => {
    writeQueue(itineraryRef.current, queueRef.current);
    setPendingCount(queueRef.current.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current || !enabledRef.current) return;
    const queue = queueRef.current;
    if (queue.length === 0) return;

    flushingRef.current = true;
    setUploading(true);

    const batch = queue.slice(0, MAX_BATCH);
    try {
      const result = await sendTrackingPoints(itineraryRef.current, batch);
      queueRef.current = queueRef.current.filter(
        (point) => !batch.some((sent) => sent.recorded_at === point.recorded_at && sent.lat === point.lat && sent.lng === point.lng),
      );
      persist();
      setMessage(null);
      onUploadedRef.current?.(result);
    } catch {
      // Keep the batch queued. A later flush retries it, and the queue survives reloads.
      setMessage("Location updates are queued and will retry when the connection returns.");
    } finally {
      flushingRef.current = false;
      setUploading(false);
    }
  }, [persist]);

  const releaseWakeLock = useCallback(() => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) void sentinel.release().catch(() => undefined);
    setWakeLockState((state) => (state === "inactive" ? state : "inactive"));
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!enabledRef.current) return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) {
      setWakeLockState("unsupported");
      return;
    }

    try {
      sentinelRef.current = await wakeLock.request("screen");
      sentinelRef.current.addEventListener?.("release", () => {
        sentinelRef.current = null;
        setWakeLockState("inactive");
      });
      setWakeLockState("active");
    } catch {
      setWakeLockState("denied");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (uploadTimerRef.current !== null) {
        window.clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWatching(false);
      releaseWakeLock();
      return;
    }

    if (!supported) {
      setMessage("This browser can't share your location. Live tracking stays off.");
      return;
    }

    setMessage(null);
    queueRef.current = readQueue(itineraryId);
    setPendingCount(queueRef.current.length);

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          setPermission(status.state);
          status.onchange = () => {
            setPermission(status.state);
            if (status.state === "denied") {
              setMessage("Location permission was denied. Enable it in your browser site settings, then retry.");
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              releaseWakeLock();
            }
          };
        })
        .catch(() => undefined);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (fix) => {
        const now = Date.now();
        const recordedAt = new Date(fix.timestamp || now).toISOString();
        const next: LivePosition = {
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy: Number.isFinite(fix.coords.accuracy) ? fix.coords.accuracy : null,
          heading: Number.isFinite(fix.coords.heading) ? fix.coords.heading : null,
          speed: Number.isFinite(fix.coords.speed) ? fix.coords.speed : null,
          recordedAt: recordedAt,
        };

        const previous = positionRef.current;
        if (previous && (next.accuracy ?? Infinity) > 100 && (previous.accuracy ?? Infinity) <= 100) return;
        if (previous && haversineKm(previous.lat, previous.lng, next.lat, next.lng) * 1000 < MIN_FORMAT_DISTANCE_M) {
          next.lat = previous.lat;
          next.lng = previous.lng;
        }

        if (now - lastUiUpdateAtRef.current >= 2_000 || previous === null) {
          lastUiUpdateAtRef.current = now;
          positionRef.current = next;
          setPosition(next);
        }
        setWatching(true);
        setPermission("granted");
        setMessage(null);

        if (now - lastFixAtRef.current < LOCAL_THROTTLE_MS) return;
        lastFixAtRef.current = now;

        const last = lastPolylineRef.current;
        const movedM =
          last === null
            ? Number.POSITIVE_INFINITY
            : haversineKm(last.lat, last.lng, next.lat, next.lng) * 1000;

        if (movedM >= MIN_FORMAT_DISTANCE_M) {
          lastPolylineRef.current = { lat: next.lat, lng: next.lng };
          setTraveled((points) => [...points.slice(-1_000), next]);
        }

        if (now - lastQueuedAtRef.current < LOCAL_THROTTLE_MS) return;
        lastQueuedAtRef.current = now;

        queueRef.current = [
          ...queueRef.current,
          {
            lat: next.lat,
            lng: next.lng,
            accuracy: next.accuracy,
            speed: Number.isFinite(fix.coords.speed) ? fix.coords.speed : null,
            heading: Number.isFinite(fix.coords.heading) ? fix.coords.heading : null,
            recorded_at: recordedAt,
          },
        ];
        persist();
      },
      (error) => {
        setWatching(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermission("denied");
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          releaseWakeLock();
        }
        setMessage(geolocationMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20_000,
      },
    );

    void requestWakeLock();

    uploadTimerRef.current = window.setInterval(() => {
      void flush();
    }, UPLOAD_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !enabledRef.current) return;
      if (sentinelRef.current === null) void requestWakeLock();
      void flush();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (uploadTimerRef.current !== null) {
        window.clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
      releaseWakeLock();
      setWatching(false);
    };
    // requestWakeLock/flush/persist are stable; itineraryId intentionally restarts the watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, itineraryId, supported, retryCount]);

  // Clear local history when switching trips or leaving the planner.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTraveled([]);
    setPosition(null);
    positionRef.current = null;
    lastPolylineRef.current = null;
    lastFixAtRef.current = 0;
    lastQueuedAtRef.current = 0;
  }, [itineraryId]);

  const retryNow = useCallback(() => {
    void flush();
  }, [flush]);
  const retryLocation = useCallback(() => setRetryCount((count) => count + 1), []);

  const wakeLockNotice =
    wakeLockState === "unsupported"
      ? "This browser can't keep the screen awake. Keep the app open for reliable tracking."
      : wakeLockState === "denied"
        ? "Keep the screen on. The browser declined to keep it awake for you."
        : null;

  return {
    position,
    traveled,
    watching,
    supported,
    permission,
    message,
    pendingCount,
    uploading,
    wakeLockState,
    wakeLockNotice,
    retryNow,
    retryLocation,
    flush,
  };
}
