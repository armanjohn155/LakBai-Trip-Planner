import { useMemo, useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router";

import { DestinationCard } from "@/components/features/destinations/destination-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { apiError, createItinerary, getDestinations, getItineraries } from "@/lib/api";
import { formatMoney, pluralise, toNumber } from "@/lib/format";
import { monthSeed, seededPick } from "@/lib/random";
import type { Destination, Itinerary } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";

function dayPart(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, loading, error } = useAsyncData(async () => {
    const [trips, page] = await Promise.all([getItineraries(), getDestinations({ per_page: 100 })]);
    return { trips, destinations: page.data };
  });

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const activeTrips = useMemo(() => {
    if (!data) return [] as Itinerary[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return data.trips
      .filter((trip) => !trip.end_date || new Date(trip.end_date) >= today)
      .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  }, [data]);

  const snapshot = useMemo(
    () => ({
      budget: activeTrips.reduce((sum, trip) => sum + toNumber(trip.total_budget), 0),
      trips: activeTrips.length,
      stops: activeTrips.reduce((sum, trip) => sum + (trip.item_count ?? 0), 0),
    }),
    [activeTrips],
  );

  const continueTrip = activeTrips[0] ?? null;

  const recommended = useMemo(
    () => (data ? seededPick(data.destinations, 4, monthSeed()) : [] as Destination[]),
    [data],
  );

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const trip = await createItinerary({
        title,
        start_date: startDate === "" ? null : startDate,
        end_date: endDate === "" ? null : endDate,
      });
      navigate(`/app/trips/${trip.id}`);
    } catch (err) {
      setCreateError(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const firstName = user?.name.split(" ")[0] ?? "traveller";

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900 sm:text-4xl">
          {dayPart()}, {firstName}.
        </h1>
        <p className="mt-2 text-sm text-ink-600 sm:text-base">Your island, your pace — pick up right where you left off.</p>
      </section>

      {error ? <InlineError message={error} /> : null}

      {loading ? (
        <p className="text-sm text-ink-600">Gathering your trips…</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Planned budget" value={formatMoney(snapshot.budget)} note={`across ${pluralise(snapshot.trips, "active trip")}`} />
            <StatCard label="Active trips" value={String(snapshot.trips)} note="sorted by last edited" />
            <StatCard label="Planned stops" value={String(snapshot.stops)} note="waiting for you to pin more" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="space-y-6">
              {continueTrip ? (
                <Card className="overflow-hidden">
                  <div className="bg-lagoon-900 p-6 text-sand-50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-surf-300">Continue planning</p>
                    <h2 className="mt-1 font-display text-2xl font-semibold">{continueTrip.title}</h2>
                    <p className="mt-1 text-sm text-sand-50/70">
                      {pluralise(continueTrip.item_count ?? 0, "stop")} · {formatMoney(continueTrip.total_budget)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-5">
                    <p className="text-sm text-ink-600">Last edited {continueTrip.updated_at ? new Date(continueTrip.updated_at).toLocaleDateString() : "recently"}.</p>
                    <Button onClick={() => navigate(`/app/trips/${continueTrip.id}`)}>Continue →</Button>
                  </div>
                </Card>
              ) : (
                <EmptyState
                  title="No trips in motion"
                  detail="Once you start a trip it shows up here, ready to continue."
                  action={<Button onClick={() => document.getElementById("start-new")?.scrollIntoView({ behavior: "smooth" })}>Start a trip</Button>}
                />
              )}

              <Card className="p-5" >
                <div id="start-new" className="scroll-mt-24">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-xl font-medium text-lagoon-900">Start a new itinerary</h2>
                    <Link to="/app/trips" className="text-sm font-semibold text-sea-500 hover:text-sea-600">
                      Manage all trips
                    </Link>
                  </div>
                  <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Input label="Trip name" placeholder="Sardine run + canyon" required value={title} onChange={(event) => setTitle(event.target.value)} />
                    <Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    <Input label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    {createError ? <p className="text-sm text-red-600 sm:col-span-3">{createError}</p> : null}
                    <div className="sm:col-span-3">
                      <Button type="submit" disabled={creating || !title.trim()}>
                        {creating ? "Creating…" : "Create and open planner"}
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>
            </div>

            <aside className="space-y-6">
              <Card className="p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-xl font-medium text-lagoon-900">My trips</h2>
                  <Link to="/app/trips" className="text-sm font-semibold text-sea-500 hover:text-sea-600">
                    View all
                  </Link>
                </div>
                {data?.trips.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-600">Nothing here yet — create your first trip on the left.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {data?.trips.slice(0, 5).map((trip) => (
                      <li key={trip.id}>
                        <Link
                          to={`/app/trips/${trip.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-sand-100"
                        >
                          <span className="min-w-0 truncate text-sm font-medium text-ink-900">{trip.title}</span>
                          <span className="shrink-0 text-sm text-ink-600">{formatMoney(trip.total_budget)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </aside>
          </section>
        </>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-medium text-lagoon-900">This month's picks</h2>
          <p className="text-sm text-ink-600">A rotating handful from the map, based on the month.</p>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-ink-600">Loading picks…</p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((destination) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                onClick={() => navigate("/destinations", { state: { focusId: destination.id } })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-ink-600">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-lagoon-900">{value}</p>
      <p className="mt-1 text-xs text-ink-600">{note}</p>
    </Card>
  );
}