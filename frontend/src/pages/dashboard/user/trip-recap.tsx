import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { RecapDesignPanel } from "@/components/features/recap/recap-design-panel";
import { RecapGallery } from "@/components/features/recap/recap-gallery";
import { RecapSharePanel } from "@/components/features/recap/recap-share-panel";
import { RecapStory } from "@/components/features/recap/recap-story";
import { CheckIcon, PencilIcon, ShareIcon, ShieldIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/hooks/use-auth";
import { apiError, duplicateItinerary, getTripRecap, updateTripRecap } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { TripRecap } from "@/lib/types";

export default function TripRecapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const itineraryId = Number(id);
  const { user } = useAuth();

  const [recap, setRecap] = useState<TripRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notCompleted, setNotCompleted] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2800);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await getTripRecap(itineraryId);
      setRecap(data);
      setNotCompleted(data.lifecycle_status !== "completed");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [itineraryId]);

  useEffect(() => {
    if (!Number.isFinite(itineraryId) || itineraryId <= 0) return;
    let active = true;
    getTripRecap(itineraryId)
      .then((data) => {
        if (!active) return;
        setRecap(data);
        setNotCompleted(data.lifecycle_status !== "completed");
      })
      .catch((err: unknown) => {
        if (active) setError(apiError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [itineraryId]);

  const refresh = useCallback(async () => {
    const data = await getTripRecap(itineraryId);
    setRecap(data);
    setNotCompleted(data.lifecycle_status !== "completed");
  }, [itineraryId]);

  const setCover = useCallback(
    async (photoId: number) => {
      const updated = await updateTripRecap(itineraryId, { cover_photo_id: photoId, show_photos: true });
      setRecap(updated);
    },
    [itineraryId],
  );

  const planAgain = async () => {
    setDuplicating(true);
    setError(null);
    try {
      const copy = await duplicateItinerary(itineraryId);
      navigate(`/app/trips/${copy.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDuplicating(false);
    }
  };

  if (!Number.isFinite(itineraryId) || itineraryId <= 0) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <EmptyState title="This recap isn't available" detail="That trip link doesn't look right." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-600">
        <Spinner className="h-7 w-7" />
        <p className="text-sm">Putting your trip memories together...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <EmptyState
          title="This recap isn't available"
          detail={error}
          action={
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setError(null);
                void load();
              }}
            >
              Try again
            </Button>
          }
        />
        <p className="mt-4 text-center text-sm text-ink-600">
          <Link className="font-semibold text-sea-600 hover:text-sea-500" to="/app/trips">
            Back to your trips
          </Link>
        </p>
      </div>
    );
  }

  if (!recap) {
    return <InlineError message="The recap could not be loaded." />;
  }

  const canEdit = recap.permissions.can_edit;
  const canUpload = recap.permissions.can_upload_photos;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/app/trips" className="font-semibold text-ink-600 hover:text-ink-900">
            Trips
          </Link>
          <span className="text-ink-400">/</span>
          <span className="font-semibold text-lagoon-900">{recap.title}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sea-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sea-600">
            <CheckIcon className="h-3 w-3" /> Completed
          </span>
        </div>

        <Link
          to={`/app/trips/${recap.itinerary_id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 hover:text-sea-500"
        >
          Open trip workspace
        </Link>
        <Button variant="secondary" onClick={() => void planAgain()} disabled={duplicating}>
          {duplicating ? "Copying trip…" : "Plan this again"}
        </Button>
      </div>

      {notCompleted ? (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl bg-mango-400/10 px-4 py-3 text-sm text-lagoon-900 ring-1 ring-inset ring-mango-400/30">
          <ShieldIcon className="mt-0.5 h-4 w-4 text-mango-500" />
          <p className="min-w-0 flex-1">
            This trip hasn't been finished yet, so the recap is only a draft. Finish the trip from the workspace to lock in
            the route and stats.
          </p>
          <Link to={`/app/trips/${recap.itinerary_id}`} className="font-semibold text-sea-600 hover:text-sea-500">
            Go to trip
          </Link>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-ink-600 ring-1 ring-inset ring-line/60">
        <p className="flex items-start gap-2">
          <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sea-600" />
          <span>
            Completed trips are read-only in the itinerary planner, except stop notes and photos. The recap itself stays
            editable — change the design, photos or sharing any time.
          </span>
        </p>
      </div>

      <RecapStory
        title={recap.title}
        summary={recap.summary}
        startDate={recap.start_date}
        endDate={recap.end_date}
        dayCount={recap.day_count}
        coverPhoto={recap.cover_photo}
        accent={recap.theme_accent}
        members={recap.members}
        memberCount={recap.member_count}
        stats={recap.stats}
        showStats={recap.show_stats}
        hideEndpoints={recap.hide_endpoints}
        route={recap.route}
        stops={recap.stops}
        photos={recap.photos}
        showReviewLinks
        actions={
          canEdit ? (
            <>
              <Button size="sm" variant="sand" onClick={() => setDesignOpen(true)}>
                <PencilIcon className="h-4 w-4" />
                Design
              </Button>
              <Button size="sm" variant="ghost" className="ring-1 ring-inset ring-white/25" onClick={() => setShareOpen(true)}>
                <ShareIcon className="h-4 w-4" />
                Share
              </Button>
            </>
          ) : null
        }
        renderGallery={({ openPhotoId, onOpenPhotoChange }) => (
          <RecapGallery
            itineraryId={recap.itinerary_id}
            photos={recap.photos}
            stops={recap.stops}
            coverPhotoId={recap.cover_photo_id}
            canUpload={canUpload}
            isOwner={canEdit}
            currentUserId={user?.id ?? null}
            onChanged={refresh}
            onSetCover={setCover}
            onNotify={showToast}
            openPhotoId={openPhotoId}
            onOpenPhotoChange={onOpenPhotoChange}
          />
        )}
      />

      {canEdit ? (
        <>
          <RecapDesignPanel
            open={designOpen}
            recap={recap}
            onClose={() => setDesignOpen(false)}
            onSaved={(updated) => {
              setRecap(updated);
              showToast("Recap design saved.");
            }}
          />
          <RecapSharePanel
            open={shareOpen}
            recap={recap}
            onClose={() => setShareOpen(false)}
            onChanged={(updated) => {
              if (updated) setRecap(updated);
              else void refresh();
            }}
            onNotify={showToast}
          />
        </>
      ) : null}

      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 left-1/2 z-[1500] -translate-x-1/2 rounded-full bg-lagoon-900 px-4 py-2 text-sm font-medium text-sand-50 shadow-lg",
          )}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
