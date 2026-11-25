import { useEffect, useMemo, useState } from "react";

import { Link } from "react-router";

import { tripStatus } from "@/components/features/itinerary/trip-card";
import { FriendsIcon, PinIcon, UserIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatMoney, pluralise } from "@/lib/format";
import type { Destination, Itinerary } from "@/lib/types";

// Freely-licensed Cebu landmark photo (Wikimedia Commons) used as the hero
// poster/fallback while the background video loads — or permanently, for
// visitors who prefer reduced motion. Hot-linked here for the dev preview;
// move it under local storage before production and confirm attribution.
const HERO_POSTER =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Kawasan%20Falls%2C%20Cebu%2C%20Philippines1.jpg";

// Looping hero background video (public/hero-video/video-hero.mp4).
// If you add a .webm encode, drop it next to the .mp4 and add a
// <source> tag for it above the .mp4 source.
const HERO_VIDEO = "/hero-video/video-hero.mp4";

const RECENT_TRIP_LIMIT = 1;
const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

type RecentTripStatus = "Planned" | "Ongoing" | "Completed" | "Cancelled";

const statusTone: Record<RecentTripStatus, "surf" | "mango" | "sea" | "neutral"> = {
  Planned: "surf",
  Ongoing: "mango",
  Completed: "sea",
  Cancelled: "neutral",
};

function usePrefersReducedMotion() {
  // Lazy initializer is SSR-safe: falls back to `false` on the server, where
  // window/matchMedia don't exist, and reads the real value on the client.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}

interface HomepageBannerSectionProps {
  destinations: Destination[];
  loggedIn: boolean;
  sessionLoading: boolean;
  itineraries: Itinerary[];
  tripsLoading: boolean;
  tripsError: string | null;
  onRetryTrips: () => Promise<boolean>;
  onBrowse: () => void;
  onBuildTrip: () => void;
}

export function HomepageBannerSection({
  destinations,
  loggedIn,
  sessionLoading,
  itineraries,
  tripsLoading,
  tripsError,
  onRetryTrips,
  onBrowse,
  onBuildTrip,
}: HomepageBannerSectionProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const stats = useMemo(
    () => ({
      spots: destinations.length,
      categories: new Set(destinations.map((d) => d.category)).size,
      regions: new Set(destinations.map((d) => d.region)).size,
    }),
    [destinations],
  );

  return (
    <>
      <section className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden text-sand-50 sm:min-h-0">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          preload="auto"
          poster={HERO_POSTER}
          aria-hidden="true"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-tr from-royal-950 via-royal-950/20 to-royal-700/20" aria-hidden="true" />

        <div className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl flex-col items-center px-5 pb-6 pt-12 text-center sm:block sm:min-h-0 sm:px-6 sm:py-28 sm:text-left">
          <p className="text-sm font-semibold tracking-wide text-surf-300 sm:text-base">LAKBAI — Cebu on one map</p>
          <h1 className="mt-4 max-w-[12ch] font-brand text-[2.1rem] font-semibold leading-[1.05] sm:mt-3 sm:max-w-3xl sm:text-6xl">
            MANGLAKAW TA BAI!
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-sand-50/85 sm:mt-5 sm:max-w-xl sm:text-lg">
            Curated spots across Metro Cebu, North, and South — pinned with the estimated cost, so your trip plans itself
            around a budget you can see.
          </p>

          <div className="mt-auto flex w-full flex-col gap-3 pt-10 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:pt-0">
            <Button variant="primary" size="lg" className="min-h-14 w-full text-base sm:min-h-0 sm:w-auto" onClick={onBuildTrip}>
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Build a trip</span>
            </Button>
            <Button variant="ghost" size="lg" className="w-full ring-1 ring-inset ring-white/40 hover:bg-white/15 sm:w-auto" onClick={onBrowse}>
              Browse destinations
            </Button>
          </div>

          {!loggedIn && !sessionLoading ? (
            <dl className="mt-12 hidden gap-8 border-t border-white/20 pt-6 sm:mt-16 sm:flex">
              <Stat value={stats.spots} label={stats.spots === 1 ? "curated spot" : "curated spots"} />
              <Stat value={stats.categories} label={stats.categories === 1 ? "category" : "categories"} />
              <Stat value={stats.regions} label={stats.regions === 1 ? "region" : "regions"} />
            </dl>
          ) : null}
        </div>
      </section>

      <div className="relative z-10 mx-auto mb-10 mt-8 max-w-6xl px-4 sm:-mt-20 sm:mb-14 sm:px-6">
        <RecentItinerariesPanel
          loggedIn={loggedIn}
          sessionLoading={sessionLoading}
          itineraries={itineraries}
          loading={tripsLoading}
          error={tripsError}
          onRetry={onRetryTrips}
        />
      </div>
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

const newestFirst = (a: Itinerary, b: Itinerary): number =>
  String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tripDateRange(itinerary: Itinerary): string {
  const start = parseDate(itinerary.start_date);
  const end = parseDate(itinerary.end_date);
  if (start && end) return `${dateFormat.format(start)} – ${dateFormat.format(end)}`;
  if (start) return dateFormat.format(start);
  if (end) return dateFormat.format(end);
  return "Dates not set";
}

function recentTripStatus(itinerary: Itinerary): RecentTripStatus {
  switch (itinerary.lifecycle_status) {
    case "planned":
      return "Planned";
    case "active":
    case "paused":
      return "Ongoing";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default: {
      const status = tripStatus(itinerary);
      if (status === "past") return "Completed";
      if (status === "in-progress") return "Ongoing";
      return "Planned";
    }
  }
}

interface RecentItinerariesPanelProps {
  loggedIn: boolean;
  sessionLoading: boolean;
  itineraries: Itinerary[];
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<boolean>;
}

function RecentItinerariesPanel({ loggedIn, sessionLoading, itineraries, loading, error, onRetry }: RecentItinerariesPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const recent = useMemo(() => [...itineraries].sort(newestFirst).slice(0, RECENT_TRIP_LIMIT), [itineraries]);
  const isLoading = sessionLoading || (loggedIn && loading);

  const handleRetry = async () => {
    setToast(null);
    const succeeded = await onRetry();
    setToast(succeeded ? "Trips refreshed." : "Couldn't refresh your trips. Please try again.");
  };

  return (
    <div className="glass-frost glass-frost-strong mx-auto max-w-4xl overflow-hidden rounded-2xl">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-6 pb-4 pt-5 sm:px-8 sm:pb-5">
        <h2 className="font-display text-xl font-semibold text-lagoon-900 sm:text-2xl">Recent Itineraries</h2>
        {loggedIn && !sessionLoading ? (
          <Link to="/app/trips" className="text-sm font-semibold text-sea-600 hover:text-sea-500">
            View all trips
          </Link>
        ) : null}
      </div>

      {toast ? (
        <div role="status" className={cn("bg-lagoon-900 px-6 py-2 text-sm text-sand-50 sm:px-8")}>
          {toast}
        </div>
      ) : null}

      {isLoading ? (
        <RecentItinerariesSkeleton />
      ) : !loggedIn ? (
        <GuestTripsState />
      ) : error ? (
        <div className="px-4 py-5 sm:px-6">
          <InlineError message={error} />
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void handleRetry()} disabled={loading}>
            Retry
          </Button>
        </div>
      ) : recent.length > 0 ? (
        <RecentTripRow itinerary={recent[0]} />
      ) : (
        <EmptyTripsState />
      )}
    </div>
  );
}

function RecentItinerariesSkeleton() {
  return (
    <div role="status" aria-label="Loading recent trips" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-stretch sm:gap-4 sm:p-6">
      <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-sand-200 sm:aspect-[4/3] sm:h-auto sm:w-40 lg:w-44" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <div className="h-4 w-2/3 animate-pulse rounded bg-sand-200" />
        <div className="h-3 w-full max-w-md animate-pulse rounded bg-sand-200" />
        <div className="h-3 w-1/2 max-w-xs animate-pulse rounded bg-sand-200" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-full bg-sand-200 sm:w-20" />
      <span className="sr-only">Loading recent trips…</span>
    </div>
  );
}

function GuestTripsState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:py-12">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-sea-600">
        <PinIcon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold text-lagoon-900 sm:text-xl">Sign in to see your trips</h3>
        <p className="mt-1 text-sm text-ink-600 sm:text-base">
          Your planned, shared and completed itineraries will show up here once you sign in.
        </p>
      </div>
      <Link
        to="/login"
        className="inline-flex items-center justify-center rounded-full bg-sand-100 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 sm:text-base"
      >
        Sign in
      </Link>
    </div>
  );
}

function EmptyTripsState() {
  return (
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
        className="inline-flex items-center justify-center rounded-full bg-sand-100 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 sm:text-base"
      >
        Start your first itinerary
      </Link>
    </div>
  );
}

const focusRingClass = (classes: string) =>
  cn(
    classes,
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white/70",
  );

function RecentTripRow({ itinerary }: { itinerary: Itinerary }) {
  const status = recentTripStatus(itinerary);
  const stops = itinerary.item_count ?? itinerary.items?.length ?? 0;
  const budget =
    itinerary.summary?.total_estimated_budget ?? itinerary.total_budget ?? itinerary.budget ?? itinerary.budget_limit;
  const facts = [
    tripDateRange(itinerary),
    pluralise(stops, "stop"),
    budget === null || budget === undefined ? null : formatMoney(budget),
  ]
    .filter(Boolean)
    .join(" · ");
  const description = itinerary.description?.trim();
  const detailHref = `/app/trips/${itinerary.id}`;
  const viewLabel = `View ${itinerary.title}`;

  return (
    <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-stretch sm:gap-4 sm:p-6">
      <Link
        to={detailHref}
        aria-label={viewLabel}
        className={focusRingClass("flex min-w-0 flex-1 flex-col gap-3 rounded-xl sm:flex-row sm:items-stretch")}
      >
        <RecentTripCover itinerary={itinerary} className="h-24 w-24 shrink-0 sm:aspect-[4/3] sm:h-auto sm:w-40 lg:w-44" />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="truncate font-display text-lg font-semibold text-lagoon-900 sm:text-xl" title={itinerary.title}>
            {itinerary.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-600">
            <span className="font-medium text-ink-700">{facts}</span>
            {description ? ` — ${description}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={statusTone[status]}>{status}</Badge>
            <Badge tone="neutral" className="inline-flex items-center gap-1">
              {itinerary.trip_type === "group" ? <FriendsIcon className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
              {itinerary.trip_type === "group" ? "Group" : "Solo"}
            </Badge>
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 items-stretch sm:items-end">
        <Link
          to={detailHref}
          aria-label={viewLabel}
          className={focusRingClass(
            "inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full bg-surf-400 px-5 text-sm font-semibold text-white transition-colors hover:bg-surf-300 active:bg-surf-400 sm:w-auto",
          )}
        >
          View
        </Link>
      </div>
    </article>
  );
}

function RecentTripCover({ itinerary, className }: { itinerary: Itinerary; className?: string }) {
  const [errored, setErrored] = useState(false);
  const coverUrl = errored
    ? null
    : (itinerary.cover_image_url ?? itinerary.items?.map((item) => item.destination?.image_url).find(Boolean) ?? null);

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-sea-500 to-surf-400",
        className,
      )}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sand-50">
          <PinIcon className="h-6 w-6" />
        </span>
      )}
    </span>
  );
}
