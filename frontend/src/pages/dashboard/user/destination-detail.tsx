import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { ActivitiesList } from "@/components/features/destination-detail/activities-list";
import { getDestinationFacts, galleryImages } from "@/components/features/destination-detail/destination-facts";
import { ImageGallery } from "@/components/features/destination-detail/image-gallery";
import { InfoCards } from "@/components/features/destination-detail/info-cards";
import { NearbyDestinations } from "@/components/features/destination-detail/nearby-destinations";
import { QuickActions } from "@/components/features/destination-detail/quick-actions";
import { TipsList } from "@/components/features/destination-detail/tips-list";
import { TransportList } from "@/components/features/destination-detail/transport-list";
import { categoryTag, categoryTone, destinationLocation, RatingLine } from "@/components/features/destinations/destination-explorer-card";
import { TripChooser } from "@/components/features/destinations/trip-chooser";
import { ArrowLeftIcon, CheckIcon, HeartIcon, PinIcon, ShareIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { useAddToTrip } from "@/hooks/use-add-to-trip";
import { useFavorites } from "@/hooks/use-favorites";
import { apiError, getDestination, getDestinations } from "@/lib/api";
import { cn } from "@/lib/cn";
import { nearestDestinations } from "@/lib/geo";
import type { Destination, Itinerary } from "@/lib/types";

export default function DestinationDetailPage() {
  const { id } = useParams();
  const destinationId = Number(id);
  const navigate = useNavigate();
  const { isFavorited, toggle: toggleFavorite } = useFavorites();
  const { trips, tripsLoading, busyTripId, creating, error: chooserError, toast, addToTrip, createAndAdd, resetError } = useAddToTrip();

  const [destination, setDestination] = useState<Destination | null>(null);
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChooser, setShowChooser] = useState(false);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="space-y-6">
      <Link to="/destinations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 transition-colors hover:text-sea-500">
        <ArrowLeftIcon className="h-4 w-4" />
        Destinations
      </Link>

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

      <ImageGallery images={galleryImages(destination)} name={destination.name} fallbackTone={categoryTone(destination.category)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Badge tone="neutral">{categoryTag(destination.category)}</Badge>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-lagoon-900 sm:text-4xl">{destination.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-1 text-sm font-medium text-ink-600">
            <PinIcon className="h-4 w-4 text-sea-600" />
            {destinationLocation(destination)} · {destination.region}
          </p>
          <RatingLine destination={destination} className="mt-1.5" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void share(destination)}
            aria-label="Share this destination"
            className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-inset ring-line transition-colors hover:bg-sand-100"
          >
            {copied ? <CheckIcon className="h-5 w-5 text-emerald-600" /> : <ShareIcon className="h-5 w-5 text-ink-600" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleFavorite(destination)}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-inset ring-line transition-colors hover:bg-sand-100"
          >
            <HeartIcon filled={favorited} className={cn("h-5 w-5", favorited ? "text-mango-400" : "text-ink-600")} />
          </button>
        </div>
      </div>

      <InfoCards entranceFee={facts.entrance_fee} visitDuration={facts.visit_duration} openingHours={facts.opening_hours} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="space-y-6">
          <Section title="About">
            <p className="text-base leading-relaxed text-ink-900">{destination.description}</p>
          </Section>

          <Section title="Activities">
            <ActivitiesList activities={facts.activities} />
          </Section>

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

        <aside className="lg:sticky lg:top-24">
          <QuickActions
            destination={destination}
            favorited={favorited}
            onToggleFavorite={() => void toggleFavorite(destination)}
            onAddToTrip={() => {
              resetError();
              setShowChooser(true);
            }}
            onViewOnMap={() => navigate(`/map?d=${destination.id}`)}
          />
        </aside>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-medium text-lagoon-900">{title}</h2>
      </div>
      {children}
    </Card>
  );
}