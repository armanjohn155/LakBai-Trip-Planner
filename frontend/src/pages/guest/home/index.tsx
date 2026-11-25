import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocation, useNavigate } from "react-router";

import { CardDataSection } from "@/components/features/home/card-data-section";
import { DestinationsMapPanel } from "@/components/features/home/destinations-map-panel";
import { DestinationShowcase } from "@/components/features/home/destination-showcase";
import { FeatureSection } from "@/components/features/home/feature-section";
import { FeatureHighlights } from "@/components/features/home/feature-highlights";
import { ForYouRecommendations } from "@/components/features/home/for-you-recommendations";
import { HomepageBannerSection } from "@/components/features/home/homepage-banner-section";
import { LakbaiFeatures } from "@/components/features/home/lakbai-features";
import { NearByYou } from "@/components/features/home/near-by-you";
import { ProfileSection } from "@/components/features/home/profile-section";
import { TrendingDestinations } from "@/components/features/home/trending-destinations";
import { InlineError } from "@/components/ui/feedback";
import { Section } from "@/components/common/section";
import { getDestinations, apiError } from "@/lib/api";
import type { Destination, DestinationFilters } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useRecentItineraries } from "@/hooks/use-recent-itineraries";

const EMPTY_FILTERS: DestinationFilters = { category: "", region: "", search: "", min_price: "", max_price: "" };

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const loggedIn = Boolean(user) && !authLoading;
  const {
    trips,
    loading: tripsLoading,
    error: tripsError,
    refresh: refreshTrips,
  } = useRecentItineraries(user?.id ?? null, loggedIn);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [filters, setFilters] = useState<DestinationFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDestinations({ per_page: 100 })
      .then((page) => {
        if (!cancelled) setDestinations(page.data);
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
  }, []);

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
    navigate(loggedIn ? "/app" : "/register");
  };

  if (loading) {
    return <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-ink-600">Loading Cebu…</p>;
  }

  return (
    <div className="flex flex-col pb-[calc(var(--bottom-nav-h)+1rem)] md:pb-0">
      {/* Hero banner: visible for both logged-in and logged-out users */}
      <div className="order-1">
        <HomepageBannerSection
          destinations={destinations}
          loggedIn={loggedIn}
          sessionLoading={authLoading}
          itineraries={trips}
          tripsLoading={tripsLoading}
          tripsError={tripsError}
          onRetryTrips={refreshTrips}
          onBrowse={scrollToDestination}
          onBuildTrip={buildTrip}
        />
      </div>

      {error ? (
        <div className="order-2">
          <Section>
            <InlineError message={error} />
          </Section>
        </div>
      ) : null}

      {/* Mobile-only personalized sections: logged-in only */}
      {loggedIn ? (
        <>
          <div className="order-3 md:hidden">
            <TrendingDestinations
              destinations={destinations}
              onSelect={handleSelect}
              sectionTitle="Trending destinations"
            />
          </div>

          <div className="order-4 md:hidden">
            <ForYouRecommendations
              destinations={destinations}
              onSelect={handleSelect}
              sectionTitle="For you"
            />
          </div>

          <div className="order-5 md:hidden">
            <NearByYou
              destinations={destinations}
              onSelect={handleSelect}
              sectionTitle="Near by you"
            />
          </div>
        </>
      ) : null}

      <div className="order-6 md:order-8">
        <CardDataSection
          destinations={visible}
          total={destinations.length}
          categories={categories}
          filters={filters}
          onFiltersChange={setFilters}
          onSelect={handleSelect}
        />
      </div>

      <div className="order-7 md:order-7"><DestinationShowcase /></div>

      <div className="order-8 md:order-3">
        <DestinationsMapPanel
          destinations={destinations}
          selected={selected}
          onSelect={setSelected}
          loggedIn={loggedIn}
          onAddToTrip={(destination) => navigate("/app/trips", { state: { addDestinationId: destination.id } })}
          onSignUp={() => navigate("/register")}
        />
      </div>

      <div className="order-9 md:order-6"><FeatureHighlights /></div>
      <div className="order-10 md:order-4"><FeatureSection /></div>
      <div className="order-11 md:order-5"><LakbaiFeatures /></div>
      <div className="order-12"><ProfileSection loggedIn={loggedIn} tripCount={trips.length} onAction={buildTrip} /></div>
    </div>
  );
}
