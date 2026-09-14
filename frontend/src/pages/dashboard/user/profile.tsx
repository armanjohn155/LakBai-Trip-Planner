import { useCallback, useEffect, useMemo, useState } from "react";

import { Outlet, useNavigate } from "react-router";

import { ProfileSidebar } from "@/components/features/profile/profile-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { apiError, getItineraries } from "@/lib/api";
import type { Itinerary, UserSettings } from "@/lib/types";

export interface ProfileTabContext {
  trips: Itinerary[];
  tripsLoading: boolean;
  tripsError: string | null;
  refreshTrips: () => Promise<void>;
  userSettings: UserSettings | null;
  onAccountDeleted: () => Promise<void>;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const refreshTrips = useCallback(async () => {
    const list = await getItineraries();
    setTrips(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Data is fetched on mount; all state updates happen in promise callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTripsLoading(true);
    setTripsError(null);
    refreshTrips()
      .catch((err) => {
        if (!cancelled) setTripsError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setTripsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrips]);

  const stats = useMemo(() => {
    const visited = new Set(
      trips.flatMap((trip) => (trip.items ?? []).filter((item) => item.visited).map((item) => item.destination_id).filter((id) => id != null)),
    );
    return { trips: trips.length, favorites: favorites.length, visited: visited.size };
  }, [trips, favorites]);

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:items-start">
      <aside className="lg:sticky lg:top-24">
        <ProfileSidebar user={user} stats={stats} onSignOut={() => void signOut()} />
      </aside>

      <div className="min-w-0">
        <Outlet
          context={{
            trips,
            tripsLoading,
            tripsError,
            refreshTrips,
            userSettings: user.settings ?? null,
            onAccountDeleted: signOut,
          }}
        />
      </div>
    </div>
  );
}