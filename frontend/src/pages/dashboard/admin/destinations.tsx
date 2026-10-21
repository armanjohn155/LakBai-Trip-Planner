import { useEffect, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import {
  apiError,
  deleteAdminDestination,
  forceDeleteAdminDestination,
  getAdminDestinations,
  restoreAdminDestination,
  type AdminDestinationParams,
} from "@/lib/api";
import { DESTINATION_CATEGORIES, DESTINATION_REGIONS } from "@/lib/destination-constants";
import type { Destination, Paginated } from "@/lib/types";

type StatusFilter = "active" | "trashed" | "all";

interface ListFilters {
  search: string;
  category: string;
  region: string;
  status: StatusFilter;
  sort: string;
}

const SORT_OPTIONS = [
  { value: "name", label: "Name A–Z" },
  { value: "-name", label: "Name Z–A" },
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "-updated_at", label: "Recently updated" },
  { value: "estimated_cost", label: "Price: low to high" },
  { value: "-estimated_cost", label: "Price: high to low" },
  { value: "-rating", label: "Highest rated" },
];

type PendingAction = { kind: "delete" | "restore" | "force"; destination: Destination };

const STATUS_LABEL: Record<StatusFilter, string> = {
  active: "Active",
  trashed: "Archived",
  all: "All",
};

export default function AdminDestinationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filters, setFilters] = useState<ListFilters>({
    search: "",
    category: "",
    region: "",
    status: "active",
    sort: "name",
  });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Destination> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>((location.state as { toast?: string } | null)?.toast ?? null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    const params: AdminDestinationParams = {
      page,
      status: filters.status,
      sort: filters.sort,
    };
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.region) params.region = filters.region;

    getAdminDestinations(params)
      .then((response) => {
        if (!active) return;
        setData(response);
        setError(null);
        if (response.data.length === 0 && page > 1) {
          setPage(page - 1);
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setError(apiError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page, refreshKey]);

  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast(message);

  const updateFilter = (patch: Partial<ListFilters>) => {
    setLoading(true);
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const goToPage = (next: number) => {
    setLoading(true);
    setPage(next);
  };

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);

    try {
      if (pending.kind === "delete") {
        await deleteAdminDestination(pending.destination.id);
        showToast(`${pending.destination.name} was archived.`);
      } else if (pending.kind === "restore") {
        await restoreAdminDestination(pending.destination.id);
        showToast(`${pending.destination.name} was restored.`);
      } else {
        await forceDeleteAdminDestination(pending.destination.id);
        showToast(`${pending.destination.name} was permanently deleted.`);
      }
      setPending(null);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      showToast(apiError(requestError));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const destinations = data?.data ?? [];
  const meta = data?.meta;
  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? destinations.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">Destinations</h1>
          <p className="mt-1 text-sm text-ink-600">Create, edit, archive, and restore places in the library.</p>
        </div>
        <Button onClick={() => navigate("/admin/destinations/new")}>New destination</Button>
      </div>

      {error ? <InlineError message={error} /> : null}

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            label="Search"
            placeholder="Name or municipality"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Select
            label="Category"
            value={filters.category}
            onChange={(event) => updateFilter({ category: event.target.value })}
            emptyLabel="All categories"
            options={DESTINATION_CATEGORIES.map((category) => ({ value: category, label: category }))}
          />
          <Select
            label="Region"
            value={filters.region}
            onChange={(event) => updateFilter({ region: event.target.value })}
            emptyLabel="All regions"
            options={DESTINATION_REGIONS.map((region) => ({ value: region, label: region }))}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(event) => updateFilter({ status: event.target.value as StatusFilter })}
            options={(Object.keys(STATUS_LABEL) as StatusFilter[]).map((status) => ({
              value: status,
              label: STATUS_LABEL[status],
            }))}
          />
          <Select
            label="Sort"
            value={filters.sort}
            onChange={(event) => updateFilter({ sort: event.target.value })}
            options={SORT_OPTIONS}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-10 text-sm text-ink-600">
          <Spinner className="h-4 w-4" /> Loading destinations…
        </div>
      ) : destinations.length === 0 ? (
        <EmptyState
          title={filters.search || filters.category || filters.region ? "No matches" : "No destinations yet"}
          detail={
            filters.search || filters.category || filters.region
              ? "Try a different search or clear the filters."
              : "Add the first destination to get the library started."
          }
          action={
            <Button className="mt-2" onClick={() => navigate("/admin/destinations/new")}>
              New destination
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-sand-100/70 text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Cost</th>
                  <th className="px-4 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {destinations.map((destination) => {
                  const archived = Boolean(destination.deleted_at);
                  return (
                    <tr key={destination.id} className="align-middle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {destination.image_url ? (
                            <img
                              src={destination.image_url}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-line"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-xs font-semibold text-ink-600">
                              {destination.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink-900">{destination.name}</p>
                            <p className="truncate text-xs text-ink-600">{destination.municipality ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{destination.category}</td>
                      <td className="px-4 py-3 text-ink-600">{destination.region}</td>
                      <td className="px-4 py-3 text-ink-600">
                        {destination.estimated_cost ? `₱${Number(destination.estimated_cost).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {destination.rating !== null && Number(destination.rating) > 0
                          ? `${Number(destination.rating).toFixed(1)} (${destination.review_count ?? 0})`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={archived ? "mango" : "sea"}>{archived ? "Archived" : "Active"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            to={`/admin/destinations/${destination.id}/edit`}
                            className="rounded-full px-3 py-1.5 text-sm font-semibold text-sea-600 transition-colors hover:bg-sand-100"
                          >
                            Edit
                          </Link>
                          {archived ? (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "restore", destination })}>
                                Restore
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => setPending({ kind: "force", destination })}>
                                Delete forever
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="danger" onClick={() => setPending({ kind: "delete", destination })}>
                              Archive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-600">
            <span>
              {total} {total === 1 ? "destination" : "destinations"}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>
                Previous
              </Button>
              <span className="px-2 text-xs font-semibold text-ink-600">
                Page {page} of {lastPage}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= lastPage || loading}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {pending ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={() => (busy ? null : setPending(null))} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <h2 className="font-display text-xl font-semibold text-lagoon-900">
              {pending.kind === "delete"
                ? `Archive ${pending.destination.name}?`
                : pending.kind === "restore"
                  ? `Restore ${pending.destination.name}?`
                  : `Permanently delete ${pending.destination.name}?`}
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              {pending.kind === "delete"
                ? "Archived destinations are hidden from travelers and cannot be added to new itineraries. You can restore them later."
                : pending.kind === "restore"
                  ? "The destination will be visible to travelers again."
                  : "This cannot be undone. Destinations still used by an itinerary stop cannot be deleted permanently."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant={pending.kind === "restore" ? "primary" : "danger"} onClick={() => void runAction()} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {pending.kind === "delete" ? "Archive" : pending.kind === "restore" ? "Restore" : "Delete forever"}
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
