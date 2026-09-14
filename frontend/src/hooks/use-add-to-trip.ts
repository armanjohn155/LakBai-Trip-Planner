import { useCallback, useEffect, useRef, useState } from "react";

import { addItineraryItem, apiError, createItinerary, getItineraries } from "@/lib/api";
import type { Destination, Itinerary } from "@/lib/types";

export interface AddToTripToast {
  message: string;
  href?: string;
  label?: string;
}

interface UseAddToTrip {
  trips: Itinerary[];
  tripsLoading: boolean;
  busyTripId: number | null;
  creating: boolean;
  error: string | null;
  toast: AddToTripToast | null;
  addToTrip: (trip: Itinerary, destination: Destination) => Promise<boolean>;
  createAndAdd: (title: string, destination: Destination) => Promise<boolean>;
  resetError: () => void;
}

export function useAddToTrip(): UseAddToTrip {
  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [busyTripId, setBusyTripId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<AddToTripToast | null>(null);

  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getItineraries()
      .then((list) => {
        if (!cancelled) setTrips(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTripsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((message: string, href?: string, label?: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, href, label });
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const addToTrip = useCallback(
    async (trip: Itinerary, destination: Destination): Promise<boolean> => {
      setBusyTripId(trip.id);
      setError(null);
      try {
        const updated = await addItineraryItem(trip.id, { destination_id: destination.id });
        setTrips((current) => current.map((t) => (t.id === updated.id ? updated : t)));
        showToast(`Added ${destination.name} to “${updated.title}”.`, `/app/trips/${updated.id}`, "Open planner");
        return true;
      } catch (err) {
        setError(apiError(err));
        return false;
      } finally {
        setBusyTripId(null);
      }
    },
    [showToast],
  );

  const createAndAdd = useCallback(
    async (title: string, destination: Destination): Promise<boolean> => {
      setCreating(true);
      setError(null);
      try {
        const trip = await createItinerary({ title });
        const updated = await addItineraryItem(trip.id, { destination_id: destination.id });
        setTrips((current) => [...current, updated]);
        showToast(`Created “${updated.title}” with ${destination.name}.`, `/app/trips/${updated.id}`, "Open planner");
        return true;
      } catch (err) {
        setError(apiError(err));
        return false;
      } finally {
        setCreating(false);
      }
    },
    [showToast],
  );

  const resetError = useCallback(() => setError(null), []);

  return { trips, tripsLoading, busyTripId, creating, error, toast, addToTrip, createAndAdd, resetError };
}