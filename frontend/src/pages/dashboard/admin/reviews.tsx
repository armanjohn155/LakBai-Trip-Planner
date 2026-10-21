import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { StarIcon } from "@/components/icons";
import { apiError, deleteAdminReview, getAdminReviews, hideAdminReview, unhideAdminReview } from "@/lib/api";
import type { AdminReviewParams } from "@/lib/api";
import { formatCompactNumber, pluralise } from "@/lib/format";
import type { Paginated, Review } from "@/lib/types";

type StatusFilter = "all" | "visible" | "hidden" | "reported";

interface ListFilters {
  search: string;
  status: StatusFilter;
}

type PendingAction = { kind: "hide" | "unhide" | "delete"; review: Review };

export default function AdminReviewsPage() {
  const [filters, setFilters] = useState<ListFilters>({ search: "", status: "all" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Review> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
    const params: AdminReviewParams = { page, status: filters.status };
    if (filters.search) params.search = filters.search;

    getAdminReviews(params)
      .then((response) => {
        if (!active) return;
        setData(response);
        setError(null);
        if (response.data.length === 0 && page > 1) {
          setPage(page - 1);
        }
      })
      .catch((requestError) => {
        if (active) setError(apiError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page, refreshKey]);

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
      if (pending.kind === "hide") {
        await hideAdminReview(pending.review.id, "Hidden by moderator.");
        showToast("Review hidden.");
      } else if (pending.kind === "unhide") {
        await unhideAdminReview(pending.review.id);
        showToast("Review restored.");
      } else {
        await deleteAdminReview(pending.review.id);
        showToast("Review deleted.");
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

  const reviews = data?.data ?? [];
  const meta = data?.meta;
  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? reviews.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">Reviews</h1>
          <p className="mt-1 text-sm text-ink-600">Moderate traveller reviews, including those flagged by the word filter.</p>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <Input
              label="Search"
              placeholder="Search title or body…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select
            label="Status"
            value={filters.status}
            onChange={(event) => updateFilter({ status: event.target.value as StatusFilter })}
            options={[
              { value: "all", label: "All reviews" },
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
              { value: "reported", label: "Reported" },
            ]}
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-10 text-sm text-ink-600">
          <Spinner className="h-4 w-4" /> Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews found" detail="Try a different search or status filter." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-sand-100/70 text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Review</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reviews.map((review) => (
                  <tr key={review.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="truncate font-semibold text-ink-900">{review.title || "(untitled)"}</p>
                      <p className="mt-0.5 line-clamp-2 max-w-md text-xs text-ink-600">{review.body}</p>
                      <p className="mt-1 text-xs text-ink-600">by {review.author.name}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{review.destination?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-lagoon-900">
                        <StarIcon className="h-4 w-4 text-mango-400" />
                        {review.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge tone={review.is_hidden ? "mango" : "sea"}>{review.is_hidden ? "Hidden" : "Visible"}</Badge>
                        {review.report_count ? (
                          <span className="text-xs font-semibold text-sinulog-red">
                            {review.report_count} {pluralise(review.report_count, "report")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {review.is_hidden ? (
                          <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "unhide", review })}>
                            Restore
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setPending({ kind: "hide", review })}>
                            Hide
                          </Button>
                        )}
                        <Button size="sm" variant="danger" onClick={() => setPending({ kind: "delete", review })}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className="text-xs text-ink-600">
              {formatCompactNumber(total)} {pluralise(total, "review")}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>
                Previous
              </Button>
              <span className="text-xs text-ink-600">
                Page {page} of {lastPage}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= lastPage || loading} onClick={() => goToPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {pending ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={busy ? undefined : () => setPending(null)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <h2 className="font-display text-xl font-semibold text-lagoon-900">
              {pending.kind === "hide" ? "Hide this review?" : pending.kind === "unhide" ? "Restore this review?" : "Delete this review?"}
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              {pending.kind === "hide"
                ? "It will no longer appear on the destination page, and ratings will be recalculated."
                : pending.kind === "unhide"
                  ? "It will be visible to everyone again."
                  : "This permanently removes the review and its photos. This cannot be undone."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant={pending.kind === "delete" ? "danger" : "primary"} onClick={() => void runAction()} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {pending.kind === "hide" ? "Hide" : pending.kind === "unhide" ? "Restore" : "Delete"}
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
