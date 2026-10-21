import { useEffect, useState } from "react";

import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { StarIcon } from "@/components/icons";
import { apiError, deleteReview, getMyReviews } from "@/lib/api";
import { formatCompactNumber, pluralise } from "@/lib/format";
import type { Paginated, Review } from "@/lib/types";

export default function MyReviewsPage() {
  const [data, setData] = useState<Paginated<Review> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getMyReviews({ page })
      .then((response) => {
        if (!active) return;
        setData(response);
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
  }, [page, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteReview(pendingDelete.id);
      setToast("Review deleted.");
      setPendingDelete(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setToast(apiError(err));
      setPendingDelete(null);
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
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">My reviews</h1>
        <p className="mt-1 text-sm text-ink-600">Reviews you've written as a verified visitor.</p>
      </div>

      {error ? <InlineError message={error} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-10 text-sm text-ink-600">
          <Spinner className="h-4 w-4" /> Loading your reviews…
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          detail="Check in at a destination and share your experience."
          action={
            <Link to="/destinations" className="mt-2 inline-flex">
              <Button size="lg">Explore destinations</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {review.destination ? (
                        <Link to={`/destinations/${review.destination.id}`} className="truncate font-semibold text-lagoon-900 hover:text-sea-600">
                          {review.destination.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink-600">Unavailable destination</span>
                      )}
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-lagoon-900">
                        <StarIcon className="h-3.5 w-3.5 text-mango-400" />
                        {review.rating.toFixed(1)}
                      </span>
                      {review.is_hidden ? <Badge tone="mango">Pending review</Badge> : null}
                    </div>
                    {review.title ? <p className="mt-1 text-sm font-semibold text-lagoon-900">{review.title}</p> : null}
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-700">{review.body}</p>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => setPendingDelete(review)}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {meta && lastPage > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </Button>
          <span className="text-xs text-ink-600">
            {formatCompactNumber(total)} {pluralise(total, "review")} · Page {page} of {lastPage}
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
            <h2 className="font-display text-xl font-semibold text-lagoon-900">Delete your review?</h2>
            <p className="mt-2 text-sm text-ink-600">This removes it from the destination page.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : null}
                Delete
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
