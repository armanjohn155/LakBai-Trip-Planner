import { useMemo, useState } from "react";

import { Link } from "react-router";

import { PinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMoney, pluralise } from "@/lib/format";
import type { Destination, Itinerary } from "@/lib/types";

// Freely-licensed Cebu landmark photo (Wikimedia Commons) used as the hero
// backdrop. Hot-linked here for the dev preview; move it under local storage
// before production and confirm attribution.
const HERO_IMAGE_URL = "https://commons.wikimedia.org/wiki/Special:FilePath/Kawasan%20Falls%2C%20Cebu%2C%20Philippines1.jpg";

interface HomepageBannerSectionProps {
  destinations: Destination[];
  loggedIn: boolean;
  itineraries: Itinerary[];
  onBrowse: () => void;
  onBuildTrip: () => void;
}

export function HomepageBannerSection({ destinations, loggedIn, itineraries, onBrowse, onBuildTrip }: HomepageBannerSectionProps) {
  const stats = useMemo(
    () => ({
      spots: destinations.length,
      categories: new Set(destinations.map((d) => d.category)).size,
      regions: new Set(destinations.map((d) => d.region)).size,
    }),
    [destinations],
  );

  const recent = itineraries.slice(0, 3);

  return (
    <>
    <section className="relative overflow-hidden bg-gradient-to-br from-royal-950 via-royal-900 to-royal-800 text-sand-50">
      <img
        src={HERO_IMAGE_URL}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-royal-950 via-royal-950/80 to-royal-700/30" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-surf-300">LAKBAI — Cebu on one map</p>
        <h1 className="mt-3 max-w-3xl font-brand text-4xl leading-[1.05] sm:text-6xl">
          MANGLAKAW TA BAI!
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-sand-50/75 sm:text-lg">
          Curated spots across Metro Cebu, North, and South — pinned with the estimated cost, so your trip plans itself
          around a budget you can see.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={onBuildTrip}>
            Build a trip
          </Button>
          <Button variant="ghost" size="lg" className="ring-1 ring-inset ring-white/40 hover:bg-white/15" onClick={onBrowse}>
            Browse destinations
          </Button>
        </div>

        {!loggedIn ? (
          <dl className="mt-12 flex gap-8 border-t border-white/20 pt-6 sm:mt-16">
            <Stat value={stats.spots} label={stats.spots === 1 ? "curated spot" : "curated spots"} />
            <Stat value={stats.categories} label={stats.categories === 1 ? "category" : "categories"} />
            <Stat value={stats.regions} label={stats.regions === 1 ? "region" : "regions"} />
          </dl>
        ) : null}
      </div>
    </section>

    {loggedIn ? (
<div className="relative z-10 mx-auto mb-10 mt-8 max-w-6xl px-4 sm:-mt-20 sm:mb-14 sm:px-6">
        <RecentItinerariesCard recent={recent} totalItineraries={itineraries.length} />
      </div>
      ) : null}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className={cn("font-brand text-3xl text-surf-300")}>{value}</dd>
      <dd className="text-sm text-sand-50/70">{label}</dd>
    </div>
  );
}

function tripSummary(itinerary: Itinerary): string {
  const itemCount = itinerary.item_count ?? itinerary.items?.length ?? 0;

  return `${pluralise(itemCount, "stop")} planned · ${formatMoney(itinerary.total_budget)}`;
}

function RecentItinerariesCard({ recent, totalItineraries }: { recent: Itinerary[]; totalItineraries: number }) {
  return (
    <div className="glass-frost glass-frost-strong mx-auto max-w-4xl overflow-hidden rounded-2xl">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-6 pb-4 pt-5 sm:px-8 sm:pb-5">
        <h2 className="font-display text-xl text-white font-semibold text-lagoon-900 sm:text-2xl">Recent Itineraries</h2>
        {totalItineraries > recent.length ? (
          <Link to="/app/trips" className="text-sm font-semibold text-sea-600 hover:text-sea-500">
            View all
          </Link>
        ) : null}
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:py-12">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-sea-600">
            <PinIcon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-lagoon-900 sm:text-xl">No trips yet</h3>
            <p className="mt-1 text-sm text-ink-600 sm:text-base">
              Plan your first itinerary from the map and it&apos;ll show up here.
            </p>
          </div>
          <Link
            to="/app/trips/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sand-100 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 sm:text-base"
          >
            Start your first itinerary
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line px-3 pb-3 pt-1.5 sm:px-6">
          {recent.map((trip) => (
            <li key={trip.id}>
              <Link
                to={`/app/trips/${trip.id}`}
                className="flex items-center gap-4 rounded-xl px-4 py-4 transition-colors hover:bg-sand-50 sm:px-6 sm:py-5"
              >
                <RecentThumb itinerary={trip} className="h-14 w-14 shrink-0 rounded-xl sm:h-16 sm:w-16" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-lagoon-900 sm:text-lg">{trip.title}</span>
                  <span className="mt-1 block truncate text-sm text-ink-600">{tripSummary(trip)}</span>
                </span>
                <span className="shrink-0 rounded-full bg-sand-100 px-4 py-2 text-sm font-semibold text-ink-700">
                  View
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentThumb({ itinerary, className }: { itinerary: Itinerary; className?: string }) {
  const [errored, setErrored] = useState(false);
  const imageUrl = itinerary.items?.map((item) => item.destination?.image_url).find(Boolean) ?? null;

  if (!imageUrl || errored) {
    return (
      <span className={cn(className, "flex items-center justify-center bg-sand-100 text-ink-600/50")}>
        <PinIcon className="h-4 w-4" />
      </span>
    );
  }

  return <img src={imageUrl} alt="" loading="lazy" className={cn(className, "object-cover")} onError={() => setErrored(true)} />;
}