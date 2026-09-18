import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocation, useNavigate } from "react-router";

import { CardDataSection } from "@/components/features/home/card-data-section";
import { DestinationsMapPanel } from "@/components/features/home/destinations-map-panel";
import { HomepageBannerSection } from "@/components/features/home/homepage-banner-section";
import { ProfileSection } from "@/components/features/home/profile-section";
import { InlineError } from "@/components/ui/feedback";
import { Section } from "@/components/common/section";
import { getDestinations, getItineraries, apiError } from "@/lib/api";
import type { Destination, DestinationFilters, Itinerary } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

const EMPTY_FILTERS: DestinationFilters = { category: "", region: "", search: "", min_price: "", max_price: "" };

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [filters, setFilters] = useState<DestinationFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripCount, setTripCount] = useState(0);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDestinations({ per_page: 100 }),
      user ? getItineraries().catch(() => []) : Promise.resolve([]),
    ])
      .then(([page, trips]) => {
        if (cancelled) return;
        setDestinations(page.data);
        setItineraries(trips);
        setTripCount(trips.length);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visible = useMemo(() => {
    const search = filters.search?.trim().toLowerCase() ?? "";
    return destinations.filter((destination) => {
      if (filters.category && destination.category !== filters.category) return false;
      if (filters.region && destination.region !== filters.region) return false;
      if (search && !destination.name.toLowerCase().includes(search) && !destination.description.toLowerCase().includes(search)) return false;
      const min = Number(filters.min_price);
      const max = Number(filters.max_price);
      const cost = Number(destination.estimated_cost);
      if (Number.isFinite(min) && filters.min_price !== "" && cost < min) return false;
      if (Number.isFinite(max) && filters.max_price !== "" && cost > max) return false;
      return true;
    });
  }, [destinations, filters]);

  const categories = useMemo(
    () => Array.from(new Set(destinations.map((destination) => destination.category))).sort((a, b) => a.localeCompare(b)),
    [destinations],
  );

  const recentItineraries = useMemo(
    () => [...itineraries].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""))),
    [itineraries],
  );

  const scrollToMap = useCallback(() => {
    document.getElementById("destinations-map")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollToTarget = (location.state as { scrollTo?: string } | null)?.scrollTo;

  useEffect(() => {
    if (!scrollToTarget || loading) return;
    document.getElementById(scrollToTarget)?.scrollIntoView({ behavior: "smooth" });
  }, [scrollToTarget, loading]);

  const scrollToDestination = useCallback(() => {
    document.getElementById("destinations")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSelect = (destination: Destination) => {
    setSelected(destination);
    scrollToMap();
  };

  const buildTrip = () => {
    navigate(user ? "/app" : "/register");
  };

  if (loading) {
    return <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-ink-600">Loading Cebu…</p>;
  }

  return (
    <>
      <HomepageBannerSection
        destinations={destinations}
        loggedIn={Boolean(user)}
        itineraries={recentItineraries}
        onBrowse={scrollToDestination}
        onBuildTrip={buildTrip}
      />

      {error ? (
        <Section>
          <InlineError message={error} />
        </Section>
      ) : null}

      <DestinationsMapPanel
        destinations={destinations}
        selected={selected}
        onSelect={setSelected}
        loggedIn={Boolean(user)}
        onAddToTrip={(destination) => navigate("/app/trips", { state: { addDestinationId: destination.id } })}
        onSignUp={() => navigate("/register")}
      />

      <CardDataSection
        destinations={visible}
        total={destinations.length}
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        onSelect={handleSelect}
      />

      <ProfileSection loggedIn={Boolean(user)} tripCount={tripCount} onAction={buildTrip} />
    </>
  );
}