import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { ActivitiesList } from "@/components/features/destination-detail/activities-list";
import { CheckInPanel } from "@/components/features/destination-detail/check-in-panel";
import { getDestinationFacts, galleryImages } from "@/components/features/destination-detail/destination-facts";
import { ImageGallery } from "@/components/features/destination-detail/image-gallery";
import { InfoCards } from "@/components/features/destination-detail/info-cards";
import { NearbyDestinations } from "@/components/features/destination-detail/nearby-destinations";
import { QuickActions } from "@/components/features/destination-detail/quick-actions";
import { ReviewsSection } from "@/components/features/destination-detail/reviews-section";
import { TipsList } from "@/components/features/destination-detail/tips-list";
import { TransportList } from "@/components/features/destination-detail/transport-list";
import { categoryTag, categoryTone, destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { ArrowLeftIcon, CheckIcon, GridIcon, HeartIcon, PinIcon, ShareIcon, SlidersIcon, StarIcon, XIcon } from "@/components/icons";

import { Card } from "@/components/ui/card";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { useAddToTrip } from "@/hooks/use-add-to-trip";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { apiError, getDestination, getDestinations } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCompactNumber, toNumber } from "@/lib/format";
import { nearestDestinations } from "@/lib/geo";
import type { Destination, Itinerary, Visit, VisitStatus } from "@/lib/types";

export default function DestinationDetailPage() {
  const { id } = useParams();
  const destinationId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFavorited, toggle: toggleFavorite } = useFavorites();
  const { trips, tripsLoading, busyTripId, creating, error: chooserError, toast, addToTrip, createAndAdd, resetError } = useAddToTrip();

  const [destination, setDestination] = useState<Destination | null>(null);
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChooser, setShowChooser] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [visitStatus, setVisitStatus] = useState<VisitStatus>("none");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    Promise.all([getDestination(destinationId), getDestinations({ per_page: 100 })])
      .then(([data, page]) => {
        if (cancelled) return;
        setDestination(data);
        setAllDestinations(page.data);
        setVisitStatus(data.user_visit_status ?? "none");
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
  }, [destinationId]);

  const nearby = useMemo(
    () => (destination ? nearestDestinations(destination, allDestinations, 5) : []),
    [destination, allDestinations],
  );

  const handleSelectTrip = async (trip: Itinerary, destination: Destination) => {
    const ok = await addToTrip(trip, destination);
    if (ok) setShowChooser(false);
  };

  const handleCreateTrip = async (title: string, destination: Destination) => {
    const ok = await createAndAdd(title, destination);
    if (ok) setShowChooser(false);
  };

  const share = async (destination: Destination) => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: destination.name, text: `${destination.name} — ${destination.category}`, url });
      } catch {
        // The user closed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the page URL is still in the address bar.
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-600">
        <Spinner className="h-4 w-4" /> Loading destination…
      </p>
    );
  }

  if (error || !destination) {
    return (
      <div className="space-y-4">
        <InlineError message={error ?? "Destination not found."} />
        <Link to="/destinations" className="text-sm font-semibold text-sea-600 hover:text-sea-500">
          Back to destinations
        </Link>
      </div>
    );
  }

  const favorited = isFavorited(destination.id);
  const facts = getDestinationFacts(destination);
  const tips = [destination.tips, ...facts.extra_tips].filter((tip): tip is string => Boolean(tip));
  const rating = toNumber(destination.rating);
  const hasRating = Boolean(rating) || destination.review_count !== null;
  const aboutClamped = destination.description.length > 180;

  return (
    <div className="space-y-6">
      {/* A. Top bar — back button + title + share/favorite (above both cards) */}
      <div className="flex items-center gap-3">
        <Link
          to="/destinations"
          aria-label="Back to destinations"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/70 ring-1 ring-inset ring-line transition-colors hover:bg-sand-100"
        >
          <ArrowLeftIcon className="h-5 w-5 text-lagoon-900" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold tracking-tight text-lagoon-900 sm:text-3xl">
          {destination.name}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void share(destination)}
            aria-label="Share this destination"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 ring-1 ring-inset ring-line transition-colors hover:bg-sand-100"
          >
            {copied ? <CheckIcon className="h-5 w-5 text-emerald-600" /> : <ShareIcon className="h-5 w-5 text-ink-600" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleFavorite(destination)}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 ring-1 ring-inset ring-line transition-colors hover:bg-sand-100"
          >
            <HeartIcon filled={favorited} className={cn("h-5 w-5", favorited ? "text-mango-400" : "text-ink-600")} />
          </button>
        </div>
      </div>

      {toast ? (
        <div className="rounded-2xl bg-lagoon-900 px-4 py-3 text-sm text-sand-50 shadow-lg">
          {toast.message}{" "}
          {toast.href ? (
            <Link to={toast.href} className="font-semibold text-surf-300 hover:text-surf-400">
              {toast.label}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* B. Two white cards side by side (stack on mobile) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:items-start">
        {/* LEFT COLUMN — media + guest ratings (sticky on desktop, unstretched children on mobile) */}
        <div className="contents lg:block lg:sticky lg:top-20 lg:space-y-4">
          {/* LEFT CARD — media */}
          <div className="order-1 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-line/60">
            <ImageGallery
              images={galleryImages(destination)}
              name={destination.name}
              fallbackTone={categoryTone(destination.category)}
            />
          </div>

          {/* LEFT CARD — guest ratings & reviews */}
          <div className="order-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line/60 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-lagoon-900">Guest ratings</h2>
                {hasRating ? (
                  <p className="mt-2 flex items-center gap-2">
                    <StarIcon className="h-5 w-5 text-mango-400" />
                    <span className="font-display text-lg font-semibold text-lagoon-900">{rating ? rating.toFixed(1) : "—"}</span>
                    {destination.review_count !== null ? (
                      <span className="text-[13px] text-ink-600">({formatCompactNumber(destination.review_count)} reviews)</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <SlidersIcon className="h-5 w-5 shrink-0 text-ink-600" />
            </div>

            {destination.review_count !== null && destination.review_count > 0 && destination.lakbai_review_count === 0 ? (
              <p className="mt-2 text-[11px] text-ink-600">Includes ratings imported from outside sources.</p>
            ) : null}

            <div className="mt-4 border-t border-line pt-4">
              {user ? (
                <CheckInPanel
                  destination={destination}
                  status={visitStatus}
                  onStatusChange={(visit: Visit) => setVisitStatus(visit.verified ? "verified" : "manual")}
                />
              ) : (
                <p className="rounded-xl bg-sand-100/70 px-3.5 py-2.5 text-[13px] text-ink-600">
                  <Link to="/login" className="font-semibold text-sea-600 hover:text-sea-500">
                    Sign in
                  </Link>{" "}
                  to check in and record your visits.
                </p>
              )}
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <ReviewsSection destination={destination} canReview={visitStatus === "verified"} currentUserId={user?.id} />
            </div>
          </div>
        </div>

        {/* RIGHT CARD — info (no inner scrollbar; grows with content) */}
        <div className="order-2 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line/60 sm:p-6">
          {/* a. Summary box */}
          <div className="rounded-2xl bg-sand-100/70 p-3.5 ring-1 ring-inset ring-line">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-lagoon-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surf-400/15 text-sea-600">
                  <GridIcon className="h-4 w-4" />
                </span>
                {categoryTag(destination.category)}
              </span>
              {hasRating ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-lagoon-900 ring-1 ring-inset ring-line">
                  <StarIcon className="h-3.5 w-3.5 text-mango-400" />
                  {rating ? rating.toFixed(1) : "—"}
                  {destination.review_count !== null ? (
                    <span className="text-xs font-normal text-ink-600">({formatCompactNumber(destination.review_count)})</span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-600">
              <PinIcon className="h-4 w-4 shrink-0 text-sea-600" />
              <span className="min-w-0">
                {destinationLocation(destination)} · {destination.region}
              </span>
            </p>
          </div>

          {/* b. Highlights / Amenities */}
          {facts.activities.length > 0 ? (
            <PanelSection title="Highlights">
              <ActivitiesList activities={facts.activities} variant="outline" />
            </PanelSection>
          ) : null}

          {/* c. About */}
          <PanelSection title="About">
            <p className={cn("text-[13px] leading-relaxed text-ink-600", !aboutExpanded && aboutClamped && "line-clamp-4")}>
              {destination.description}
            </p>
            {aboutClamped ? (
              <button
                type="button"
                onClick={() => setAboutExpanded((prev) => !prev)}
                className="mt-2 text-[13px] font-semibold text-sea-600 transition-colors hover:text-sea-500"
              >
                {aboutExpanded ? "Show Less" : "Read More"}
              </button>
            ) : null}
          </PanelSection>

          {/* d. Quick info — one inline wrapping row of Label: value pairs */}
          <PanelSection title="Quick info">
            <InfoCards
              entranceFee={facts.entrance_fee}
              visitDuration={facts.visit_duration}
              openingHours={facts.opening_hours}
              variant="inline"
            />
          </PanelSection>

          {/* e. Ratings & Reviews moved to the left column "Guest ratings" card */}

          {/* f. Quick Actions / Plan Trip / map */}
          <PanelSection title="Quick Actions">
            <QuickActions
              embedded
              destination={destination}
              favorited={favorited}
              onToggleFavorite={() => void toggleFavorite(destination)}
              onAddToTrip={() => {
                resetError();
                setShowChooser(true);
              }}
              onViewOnMap={() => navigate(`/map?d=${destination.id}`)}
            />
          </PanelSection>
        </div>
      </div>

      {/* Remaining sections — preserved, full width below the layout */}
      <div className="space-y-6">
        <Section title="How to Get There">
          <TransportList options={facts.transport} />
        </Section>

        <Section title="Travel Tips">
          <TipsList tips={tips} />
        </Section>

        {nearby.length > 0 ? (
          <Section title="Nearby Destinations">
            <NearbyDestinations nearby={nearby} />
          </Section>
        ) : null}
      </div>

      {showChooser ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={() => setShowChooser(false)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <button
              type="button"
              onClick={() => setShowChooser(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <TripChooser
              destination={destination}
              trips={trips}
              tripsLoading={tripsLoading}
              busyTripId={busyTripId}
              creating={creating}
              error={chooserError}
              onSelect={(trip) => handleSelectTrip(trip, destination)}
              onCreate={(title) => handleCreateTrip(title, destination)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-lagoon-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-lagoon-900">{title}</h2>
      </div>
      {children}
    </Card>
  );
}
