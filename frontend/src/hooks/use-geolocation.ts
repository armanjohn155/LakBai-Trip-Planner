import { useCallback, useRef, useState } from "react";

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const watchId = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  /**
   * Resolve the device position once. `highAccuracy` trades battery for a
   * tighter fix, which matters because the backend caps GPS accuracy.
   */
  const getPosition = useCallback(
    (options?: PositionOptions): Promise<GeolocationResult> => {
      setLoading(true);
      setError(null);

      return new Promise((resolve, reject) => {
        if (!supported) {
          setLoading(false);
          setError("This browser can't share your location.");
          reject(new Error("unsupported"));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLoading(false);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          },
          (geoError) => {
            setLoading(false);
            const message =
              geoError.code === geoError.PERMISSION_DENIED
                ? "Location permission was denied. Enable it to check in."
                : geoError.code === geoError.TIMEOUT
                  ? "Getting your location timed out. Try again."
                  : "Couldn't determine your location. Try again.";
            setError(message);
            reject(new Error(message));
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options },
        );
      });
    },
    [supported],
  );

  return { getPosition, loading, error, supported, clearWatch };
}
