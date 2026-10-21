import { useCallback, useEffect, useState } from "react";

import { CheckIcon, StarIcon, UserIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { apiError, apiFieldErrors, createReview, deleteReview, getReviews, reportReview, updateReview } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCompactNumber, pluralise } from "@/lib/format";
import type { Destination, Review, ReviewReportReason } from "@/lib/types";

interface ReviewsSectionProps {
  destination: Destination;
  canReview: boolean;
  currentUserId?: number;
}

const REPORT_REASON_LABELS: Record<ReviewReportReason, string> = {
  spam: "Spam or advertising",
  offensive: "Offensive or abusive",
  fake: "Fake or misleading",
  irrelevant: "Not about this place",
  other: "Something else",
};

export function ReviewsSection({ destination, canReview, currentUserId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("recent");
  const [editing, setEditing] = useState<Review | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Review | null>(null);
  const [reporting, setReporting] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (targetPage: number) => {
      setLoading(true);
      getReviews(destination.id, { page: targetPage, sort })
        .then((response) => {
          setReviews(response.data);
          setMeta(response.meta ?? null);
          setError(null);
        })
        .catch((err) => setError(apiError(err)))
        .finally(() => setLoading(false));
    },
    [destination.id, sort],
  );

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getReviews(destination.id, { page, sort })
      .then((response) => {
        if (!active) return;
        setReviews(response.data);
        setMeta(response.meta ?? null);
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
  }, [destination.id, page, sort]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const myReview = currentUserId ? reviews.find((review) => review.author.id === currentUserId && !review.is_hidden) : undefined;
  const canWrite = canReview && !myReview;

  const refresh = () => load(page);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteReview(pendingDelete.id);
      setToast("Your review was removed.");
      setPendingDelete(null);
      refresh();
    } catch (err) {
      setToast(apiError(err));
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-lagoon-900">Traveller reviews</h3>
          <p className="mt-0.5 text-[13px] text-ink-600">
            {meta ? `${formatCompactNumber(meta.total)} ${pluralise(meta.total, "review")} from verified visitors` : "Verified visitors only"}
          </p>
        </div>
        <select
          value={sort}
          onChange={(event) => {
            setPage(1);
            setSort(event.target.value);
          }}
          aria-label="Sort reviews"
          className="h-9 rounded-xl bg-white/70 px-3 text-sm text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400"
        >
          <option value="recent">Most recent</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      {canWrite ? (
        <Button size="md" onClick={() => setShowForm(true)}>
          Write a review
        </Button>
      ) : myReview ? (
        <div className="rounded-xl bg-sand-100/70 px-3.5 py-2.5 text-[13px] text-ink-600">
          You reviewed this place.{" "}
          <button type="button" className="font-semibold text-sea-600 hover:text-sea-500" onClick={() => setEditing(myReview)}>
            Edit your review
          </button>
          .
        </div>
      ) : !canReview ? (
        <div className="rounded-xl bg-sand-100/70 px-3.5 py-2.5 text-[13px] text-ink-600">
          Only visitors with a <span className="font-semibold text-lagoon-900">GPS-verified check-in</span> can review this place. Check in when you arrive to unlock reviews.
        </div>
      ) : null}

      {error ? <InlineError message={error} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-8 text-sm text-ink-600">
          <Spinner className="h-4 w-4" /> Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-600">
          No reviews yet. Be the first verified visitor to share your experience.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwn={review.author.id === currentUserId}
              onEdit={() => setEditing(review)}
              onDelete={() => setPendingDelete(review)}
              onReport={() => setReporting(review)}
            />
          ))}
        </ul>
      )}

      {meta && meta.last_page > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </Button>
          <span className="text-xs text-ink-600">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= meta.last_page || loading} onClick={() => setPage((value) => value + 1)}>
            Next
          </Button>
        </div>
      ) : null}

      {showForm || editing ? (
        <ReviewFormModal
          destinationId={destination.id}
          review={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={(message) => {
            setShowForm(false);
            setEditing(null);
            setToast(message);
            refresh();
          }}
        />
      ) : null}

      {reporting ? (
        <ReportModal
          review={reporting}
          onClose={() => setReporting(null)}
          onReported={() => {
            setReporting(null);
            setToast("Thank you. Our moderators will take a look.");
          }}
        />
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

function ReviewCard({
  review,
  isOwn,
  onEdit,
  onDelete,
  onReport,
}: {
  review: Review;
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <li className="rounded-2xl bg-white/70 p-4 ring-1 ring-inset ring-line">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand-200 text-ink-600">
          <UserIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-lagoon-900">{review.author.name}</span>
            <span className="inline-flex items-center gap-0.5 text-mango-400">
              {Array.from({ length: 5 }).map((_, index) => (
                <StarIcon key={index} className={cn("h-3.5 w-3.5", index < review.rating ? "text-mango-400" : "text-line")} />
              ))}
            </span>
            {review.visited_on ? <span className="text-xs text-ink-600">Visited {formatReviewDate(review.visited_on)}</span> : null}
            {review.edited_at ? <Badge tone="neutral">Edited</Badge> : null}
          </div>

          {review.title ? <p className="mt-1.5 text-sm font-semibold text-lagoon-900">{review.title}</p> : null}
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-700">{review.body}</p>

          {review.photos.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {review.photos.map((photo) => (
                <img key={photo.id} src={photo.url} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-line" loading="lazy" />
              ))}
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center gap-3 text-xs font-semibold">
            {review.can?.update || isOwn ? (
              <>
                <button type="button" className="text-sea-600 hover:text-sea-500" onClick={onEdit}>
                  Edit
                </button>
                <button type="button" className="text-sinulog-red hover:opacity-80" onClick={onDelete}>
                  Delete
                </button>
              </>
            ) : null}
            {review.can?.report ? (
              <button type="button" className="text-ink-600 hover:text-ink-900" onClick={onReport}>
                Report
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

interface ReviewFormModalProps {
  destinationId: number;
  review: Review | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function ReviewFormModal({ destinationId, review, onClose, onSaved }: ReviewFormModalProps) {
  const isEditing = Boolean(review);
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [title, setTitle] = useState(review?.title ?? "");
  const [body, setBody] = useState(review?.body ?? "");
  const [visitedOn, setVisitedOn] = useState(review?.visited_on ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState(review?.photos ?? []);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (isEditing && review) {
        await updateReview(review.id, {
          rating,
          title: title.trim() || null,
          body,
          visited_on: visitedOn || null,
          photos,
          remove_photo_ids: removedIds,
        });
        onSaved("Your review was updated.");
      } else {
        await createReview(destinationId, {
          rating,
          title: title.trim() || null,
          body,
          visited_on: visitedOn || null,
          photos,
        });
        onSaved("Thanks for sharing your review!");
      }
    } catch (err) {
      const errors = apiFieldErrors(err);
      setFieldErrors(errors);
      setFormError(Object.keys(errors).length === 0 ? apiError(err) : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-2xl glass p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={busy}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
        >
          <XIcon className="h-4 w-4" />
        </button>

        <h2 className="font-display text-xl font-semibold text-lagoon-900">{isEditing ? "Edit your review" : "Write a review"}</h2>
        <p className="mt-1 text-sm text-ink-600">Share what a future traveller should know.</p>

        <div className="mt-4 space-y-3">
          {formError ? <InlineError message={formError} /> : null}

          <div>
            <span className="text-sm font-medium text-ink-900">Your rating</span>
            <div className="mt-1.5 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onClick={() => setRating(value)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                >
                  <StarIcon className={cn("h-7 w-7", value <= rating ? "text-mango-400" : "text-line")} />
                </button>
              ))}
            </div>
            {fieldErrors.rating ? <p className="mt-1 text-sm text-red-600">{fieldErrors.rating}</p> : null}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-900">Title (optional)</span>
            <input
              className="h-11 w-full rounded-xl bg-white/70 px-4 text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400 backdrop-blur-sm"
              value={title}
              maxLength={100}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Worth the trip"
            />
            {fieldErrors.title ? <p className="text-sm text-red-600">{fieldErrors.title}</p> : null}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-900">Your review</span>
            <textarea
              className="min-h-28 w-full rounded-xl bg-white/70 px-4 py-3 text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400 backdrop-blur-sm"
              value={body}
              maxLength={2000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="At least 20 characters."
            />
            {fieldErrors.body ? <p className="text-sm text-red-600">{fieldErrors.body}</p> : null}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-900">Date visited (optional)</span>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className="h-11 w-full rounded-xl bg-white/70 px-4 text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400"
              value={visitedOn}
              onChange={(event) => setVisitedOn(event.target.value)}
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-ink-900">Photos (optional, up to 3)</span>
            {existingPhotos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {existingPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => {
                      setExistingPhotos((current) => current.filter((item) => item.id !== photo.id));
                      setRemovedIds((current) => [...current, photo.id]);
                    }}
                    className="group relative h-16 w-16 overflow-hidden rounded-lg ring-1 ring-line"
                    aria-label="Remove photo"
                  >
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-lagoon-950/50 text-sand-50 opacity-0 transition-opacity group-hover:opacity-100">
                      <XIcon className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => setPhotos(Array.from(event.target.files ?? []).slice(0, 3))}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-sand-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-lagoon-900 hover:file:bg-sand-200"
            />
            {fieldErrors.photos ? <p className="text-sm text-red-600">{fieldErrors.photos}</p> : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || body.trim().length < 20}>
            {busy ? <Spinner className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
            {isEditing ? "Save changes" : "Publish review"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ review, onClose, onReported }: { review: Review; onClose: () => void; onReported: () => void }) {
  const [reason, setReason] = useState<ReviewReportReason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportReview(review.id, { reason, details: details.trim() || null });
      onReported();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl glass p-5">
        <h2 className="font-display text-xl font-semibold text-lagoon-900">Report this review</h2>
        <p className="mt-1 text-sm text-ink-600">Tell us what's wrong and our moderators will review it.</p>

        <div className="mt-4 space-y-3">
          {error ? <InlineError message={error} /> : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-900">Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ReviewReportReason)}
              className="h-11 w-full rounded-xl bg-white/70 px-3 text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400"
            >
              {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-900">Details (optional)</span>
            <textarea
              className="min-h-20 w-full rounded-xl bg-white/70 px-4 py-3 text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400"
              value={details}
              maxLength={1000}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Report
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric" }).format(date);
}
