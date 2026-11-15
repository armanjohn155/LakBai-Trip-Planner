import { useEffect, useState } from "react";

import { Link, useParams } from "react-router";

import { RecapStory } from "@/components/features/recap/recap-story";
import { MapIcon, RouteIcon, ShieldIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { apiError, getSharedRecap } from "@/lib/api";
import type { PublicTripRecap } from "@/lib/types";

/**
 * `/s/:token` — the no-login public recap. It renders only the whitelisted
 * payload; there are no member identities, budgets, notes or live positions to
 * display even if the client were tampered with.
 */
export default function SharedRecapPage() {
  const { token } = useParams<{ token: string }>();
  const [recap, setRecap] = useState<PublicTripRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!token) {
        setError("This share link is incomplete.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getSharedRecap(token);
        if (active) {
          setRecap(data);
          document.title = `${data.title} · Lakbai`;
        }
      } catch (err) {
        if (active) setError(apiError(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="font-display text-2xl font-semibold tracking-tight text-lagoon-900">
          Lakbai
        </Link>
        <Link to="/register" className="text-sm font-semibold text-sea-600 hover:text-sea-500">
          Plan a trip
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-ink-600">
            <Spinner className="h-7 w-7" />
            <p className="text-sm">Opening the trip recap...</p>
          </div>
        ) : error || !recap ? (
          <div className="mx-auto max-w-lg rounded-3xl bg-white/80 px-6 py-14 text-center shadow-sm ring-1 ring-inset ring-line/60">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-ink-500">
              <ShieldIcon className="h-6 w-6" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold text-lagoon-900">This link isn't available</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
              {error ?? "The recap may be private, expired or revoked by its owner."}
            </p>
            <p className="mt-1 text-xs text-ink-500">Share links can be turned off at any time.</p>
            <Button className="mt-5" onClick={() => (window.location.href = "/")}>
              <MapIcon className="h-4 w-4" />
              Explore Lakbai
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <RecapStory
              title={recap.title}
              summary={recap.summary}
              startDate={recap.start_date}
              endDate={recap.end_date}
              dayCount={recap.day_count}
              coverPhoto={recap.cover_photo}
              accent={recap.theme_accent}
              stats={recap.stats}
              showStats={recap.stats !== null}
              hideEndpoints={recap.hide_endpoints}
              route={recap.route}
              stops={recap.stops}
              photos={recap.photos}
              eyebrow="Shared trip recap"
            />

            <section className="relative overflow-hidden rounded-3xl bg-lagoon-900 px-6 py-10 text-center text-sand-50 shadow-xl sm:px-10">
              <div className="absolute inset-0 bg-gradient-to-tr from-lagoon-950 via-lagoon-900 to-surf-400/25" />
              <div className="relative mx-auto max-w-xl">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                  <RouteIcon className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold text-white">Plan your own trip on Lakbai</h2>
                <p className="mt-2 text-sm leading-relaxed text-sand-50/80">
                  Build a day-by-day itinerary, track the route on the ground and turn it into a recap like this one.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button variant="sand" onClick={() => (window.location.href = "/register")}>
                    Start planning free
                  </Button>
                  <Button variant="ghost" className="ring-1 ring-inset ring-white/25" onClick={() => (window.location.href = "/")}>
                    Browse destinations
                  </Button>
                </div>
              </div>
            </section>

            <p className="text-center text-[11px] text-ink-500">
              Shared with Lakbai. Exact start and end points, member identities, notes and budgets are never included.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
