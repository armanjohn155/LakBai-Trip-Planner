import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* The useFavorites hook is exported alongside the provider, so fast refresh
   can't reliably hot-swap this module. */
/* eslint-disable react-refresh/only-export-components */

import { addFavorite, getFavorites, removeFavorite } from "@/lib/api";
import type { Destination } from "@/lib/types";

interface FavoritesContextValue {
  favorites: Destination[];
  loading: boolean;
  isFavorited: (id: number) => boolean;
  toggle: (destination: Destination) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFavorites({ per_page: 100 })
      .then((page) => {
        if (!cancelled) setFavorites(page.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const favoriteIds = useMemo(() => new Set(favorites.map((destination) => destination.id)), [favorites]);

  const isFavorited = useCallback((id: number) => favoriteIds.has(id), [favoriteIds]);

  const toggle = useCallback(
    async (destination: Destination) => {
      const already = favoriteIds.has(destination.id);
      setFavorites((current) =>
        already ? current.filter((favorite) => favorite.id !== destination.id) : [destination, ...current],
      );
      try {
        if (already) {
          await removeFavorite(destination.id);
        } else {
          await addFavorite(destination.id);
        }
      } catch {
        setFavorites((current) =>
          already ? [destination, ...current] : current.filter((favorite) => favorite.id !== destination.id),
        );
      }
    },
    [favoriteIds],
  );

  return (
    <FavoritesContext.Provider value={{ favorites, loading, isFavorited, toggle }}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider.");
  }
  return context;
}