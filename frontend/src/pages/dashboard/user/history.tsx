import { useEffect, useMemo, useState } from "react";

import { Link } from "react-router";

import { VisitsMap } from "@/components/features/history/visits-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { CalendarIcon, CheckIcon, MapIcon, PinIcon, StarIcon } from "@/components/icons";
import { apiError, deleteVisit, getVisits, getVisitsMap, getVisitStats } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCompactNumber, pluralise } from "@/lib/format";
import { DESTINATION_CATEGORIES, DESTINATION_REGIONS } from "@/lib/destination-constants";
import type { Paginated, Visit, VisitedMapPlace, VisitStats } from "@/lib/types";

type VerifiedFilter = "" | "true" | "false";

export default function HistoryPage() {
  const [data, setData] = useState<Paginated<Visit> | null>(null);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [places, setPlaces] = useState<VisitedMapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [verified, setVerified] = useState<VerifiedFilter>("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params: Record<string, string | number | boolean | undefined> = { page };
    if (verified !== "") params.verified = verified;
    if (category) params.category = category;
    if (region) params.region = region;

    Promise.all([getVisits(params), getVisitStats(), getVisitsMap()])
      .then(([visitsPage, statsData, mapData]) => {
        if (!active) return;
        setData(visitsPage);
        setStats(statsData);
        setPlaces(mapData);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(apiError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, verified, category, region, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visits = data?.data ?? [];
  const meta = data?.meta;
  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? visits.length;

  const maxMonth = useMemo(() => Math.max(1, ...(stats?.per_month.map((entry) => entry.count) ?? [1])), [stats]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteVisit(pendingDelete.id);
      setToast("Visit removed from your history.");
      setPendingDelete(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setToast(apiError(err));
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const resetPage =
    <T extends string>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setLoading(true);
      setPage(1);
      setter(event.target.value as T);
    };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 px-2 py-16 text-sm text-ink-600">
        <Spinner className="h-4 w-4" /> Loading your history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">Visiting history</h1>
          <p className="mt-1 text-sm text-ink-600">Every place you've checked in — verified on the ground, never tracked.</p>
        </div>
        <Link to="/destinations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 hover:text-sea-500">
          <PinIcon className="h-4 w-4" />
          Find a place to visit
        </Link>
      </div>

      {error ? <InlineError message={error} /> : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total visits" value={formatCompactNumber(stats.total_visits)} hint="All check-ins & manual marks" />
          <StatCard label="Verified" value={formatCompactNumber(stats.verified_visits)} hint="GPS-confirmed visits" tone="sea" />
          <StatCard label="Unique places" value={formatCompactNumber(stats.unique_destinations)} hint="Distinct destinations" />
          <StatCard label="Regions" value={String(stats.regions_covered.length)} hint={stats.regions_covered.join(", ") || "—"} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-lagoon-900">Visits over the last 12 months</h2>
            <CalendarIcon className="h-4 w-4 text-ink-600" />
          </div>
          {stats ? (
            <div className="flex h-40 items-end gap-1.5">
              {stats.per_month.map((entry) => (
                <div key={entry.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-32 w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-surf-400/80 transition-all hover:bg-surf-400"
                      style={{ height: `${Math.max(entry.count === 0 ? 2 : (entry.count / maxMonth) * 100, 2)}%` }}
                      title={`${entry.label}: ${entry.count}`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-ink-600">{entry.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-lagoon-900">Places you've been</h2>
            <MapIcon className="h-4 w-4 text-ink-600" />
          </div>
          {places.length > 0 ? (
            <div className="h-64 overflow-hidden rounded-xl ring-1 ring-line">
              <VisitsMap places={places} className="h-full w-full" />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-600">
              No mapped visits yet.
            </p>
          )}
        </Card>
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Verification"
            value={verified}
            onChange={resetPage(setVerified)}
            options={[
              { value: "", label: "All visits" },
              { value: "true", label: "Verified only" },
              { value: "false", label: "Manual only" },
            ]}
          />
          <Select
            label="Category"
            value={category}
            onChange={resetPage(setCategory)}
            emptyLabel="All categories"
            options={DESTINATION_CATEGORIES.map((value) => ({ value, label: value }))}
          />
          <Select
            label="Region"
            value={region}
            onChange={resetPage(setRegion)}
            emptyLabel="All regions"
            options={DESTINATION_REGIONS.map((value) => ({ value, label: value }))}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-10 text-sm text-ink-600">
          <Spinner className="h-4 w-4" /> Loading visits…
        </div>
      ) : visits.length === 0 ? (
        <EmptyState
          title="No visits yet"
          detail="Check in at a destination to start building your Cebu history."
          action={
            <Link to="/destinations" className="mt-2 inline-flex">
              <Button size="lg">Explore destinations</Button>
            </Link>
          }
        />
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {visits.map((visit) => (
            <VisitTimelineRow key={visit.id} visit={visit} onDelete={() => setPendingDelete(visit)} />
          ))}
        </ol>
      )}

      {meta && lastPage > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </Button>
          <span className="text-xs text-ink-600">
            {formatCompactNumber(total)} {pluralise(total, "visit")} · Page {page} of {lastPage}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= lastPage || loading} onClick={() => setPage((value) => value + 1)}>
            Next
          </Button>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={busy ? undefined : () => setPendingDelete(null)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <h2 className="font-display text-xl font-semibold text-lagoon-900">Remove this visit?</h2>
            <p className="mt-2 text-sm text-ink-600">
              This removes your {pendingDelete.verified ? "verified" : "manual"} visit from your history. It won't affect the destination itself.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : null}
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-[1300] max-w-sm rounded-xl bg-lagoon-900 px-4 py-3 text-sm font-medium text-sand-50 shadow-lg" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "sea" }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">{label}</p>
      <p className={cn("mt-1.5 font-display text-3xl font-semibold", tone === "sea" ? "text-sea-600" : "text-lagoon-900")}>{value}</p>
      <p className="mt-1 truncate text-xs text-ink-600" title={hint}>
        {hint}
      </p>
    </Card>
  );
}

function VisitTimelineRow({ visit, onDelete }: { visit: Visit; onDelete: () => void }) {
  const destination = visit.destination;
  const date = new Date(visit.visited_at);

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white",
          visit.verified ? "bg-sea-500" : "bg-mango-400",
        )}
        aria-hidden="true"
      />
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand-100">
          {destination?.image_url ? (
            <img src={destination.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <PinIcon className="h-5 w-5 text-ink-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {destination ? (
              <Link to={`/destinations/${destination.id}`} className="truncate font-semibold text-lagoon-900 hover:text-sea-600">
                {destination.name}
              </Link>
            ) : (
              <span className="truncate font-semibold text-ink-600">Unavailable destination</span>
            )}
            <Badge tone={visit.verified ? "sea" : "mango"}>
              {visit.verified ? (
                <span className="inline-flex items-center gap-1">
                  <CheckIcon className="h-3 w-3" /> Verified
                </span>
              ) : (
                "Manual"
              )}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-600">
            {formatDate(date)}
            {destination ? ` · ${destination.region}` : ""}
            {visit.accuracy_m !== null ? ` · ±${visit.accuracy_m} m` : ""}
          </p>
          {visit.notes ? <p className="mt-1 line-clamp-2 text-[13px] text-ink-700">{visit.notes}</p> : null}
        </div>

        {destination && destination.rating !== null ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-lagoon-900">
            <StarIcon className="h-3.5 w-3.5 text-mango-400" />
            {Number(destination.rating).toFixed(1)}
          </span>
        ) : null}

        <Button size="sm" variant="danger" onClick={onDelete}>
          Remove
        </Button>
      </Card>
    </li>
  );
}

function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
