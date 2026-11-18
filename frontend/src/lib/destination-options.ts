import { useEffect, useState } from "react";

import { apiError, getDestinationOptions, type DestinationOption, type DestinationOptions } from "@/lib/api";

let cachedOptions: DestinationOptions | null = null;
let inflight: Promise<DestinationOptions> | null = null;
const listeners = new Set<(options: DestinationOptions) => void>();

export function getCachedDestinationOptions(): DestinationOptions | null {
  return cachedOptions;
}

export async function loadDestinationOptions(force = false): Promise<DestinationOptions> {
  if (!force && cachedOptions) return cachedOptions;
  if (!force && inflight) return inflight;

  inflight = getDestinationOptions()
    .then((options) => {
      cachedOptions = options;
      listeners.forEach((listener) => listener(options));
      return options;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Clear the client cache and refetch so every screen picks up the change. */
export function invalidateDestinationOptions(): void {
  cachedOptions = null;
  inflight = null;
  void loadDestinationOptions(true).catch(() => {
    // A later screen will retry; keep the current UI usable on network errors.
  });
}

export function useDestinationOptions() {
  const [options, setOptions] = useState<DestinationOptions | null>(cachedOptions);
  const [loading, setLoading] = useState(cachedOptions === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const listener = (next: DestinationOptions) => {
      if (!active) return;
      setOptions(next);
      setError(null);
    };

    listeners.add(listener);

    if (!cachedOptions) {
      loadDestinationOptions()
        .then((next) => {
          if (!active) return;
          setOptions(next);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setError(apiError(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  return { options, loading, error };
}

export function findOption(options: DestinationOption[] | undefined, name: string): DestinationOption | undefined {
  if (!options || !name) return undefined;
  return options.find((option) => option.name === name);
}
