import { useCallback, useSyncExternalStore } from "react";

/** Subscribe to a CSS media query without setting state in an effect. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Current viewport height, kept in sync with the browser chrome. */
export function useViewportHeight(): number {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.innerHeight,
    () => 900,
  );
}
