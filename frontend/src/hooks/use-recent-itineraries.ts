import { useCallback, useEffect, useRef, useState } from "react";

import { apiError, getAllItineraries } from "@/lib/api";
import type { Itinerary } from "@/lib/types";

interface RecentItinerariesState {
  trips: Itinerary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
}

const REQUEST_TIMEOUT_MS = 12_000;
const TIMEOUT_MESSAGE = "Can't reach your trips right now. Please try again.";

const byNewestUpdate = (a: Itinerary, b: Itinerary): number =>
  String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));

/**
 * Loads the trips the current user can access (owned, shared and accepted
 * group trips) using the same `GET /itineraries` resource as the Trips page.
 * The backend already orders by `updated_at` descending; sorting again here
 * keeps the "most recent" guarantee if the endpoint order ever changes.
 */
export function useRecentItineraries(userId: number | null, enabled: boolean): RecentItinerariesState {
  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const currentRequest = ++requestId.current;
    let timeoutId: number | undefined;
    setLoading(true);
    setError(null);

    try {
      const result = await Promise.race([
        getAllItineraries(),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), REQUEST_TIMEOUT_MS);
        }),
      ]);
      if (currentRequest !== requestId.current) return false;
      setTrips([...result].sort(byNewestUpdate));
      return true;
    } catch (err) {
      if (currentRequest !== requestId.current) return false;
      setError(err instanceof Error && err.message === TIMEOUT_MESSAGE ? TIMEOUT_MESSAGE : apiError(err));
      return false;
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || userId === null) {
      requestId.current += 1; // Ignore any response from the previous user.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrips([]);
      setError(null);
      setLoading(false);
      return;
    }

    void load();
  }, [enabled, userId, load]);

  useEffect(() => {
    if (!enabled || userId === null) return;

    const refetch = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [enabled, userId, load]);

  return { trips, loading, error, refresh: load };
}
