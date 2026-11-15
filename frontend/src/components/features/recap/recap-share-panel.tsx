import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MapIcon,
  ShareIcon,
  ShieldIcon,
} from "@/components/icons";
import {
  apiError,
  createRecapShareLink,
  downloadRecapExport,
  revokeRecapShareLink,
  updateTripRecap,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import type { RecapShareLink, RecapVisibility, TripRecap } from "@/lib/types";

import { accentTheme, formatDuration, formatRecapDate, resolveRecapMediaUrl } from "./recap-utils";

const VISIBILITIES: Array<{ value: RecapVisibility; label: string; hint: string }> = [
  { value: "private", label: "Private", hint: "Only you can open the recap." },
  { value: "members", label: "Trip members", hint: "Signed-in members of this trip." },
  { value: "link", label: "Anyone with the link", hint: "No account needed. Revocable at any time." },
  { value: "public", label: "Public", hint: "Same safe view as a link, marked as public." },
];

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

interface RecapSharePanelProps {
  open: boolean;
  recap: TripRecap;
  onClose: () => void;
  onChanged: (recap?: TripRecap) => Promise<void> | void;
  onNotify?: (message: string) => void;
}

export function RecapSharePanel({ open, recap, onClose, onChanged, onNotify }: RecapSharePanelProps) {
  if (!open) return null;
  return <RecapSharePanelContent key={recap.id} open={open} recap={recap} onClose={onClose} onChanged={onChanged} onNotify={onNotify} />;
}

function RecapSharePanelContent({ open, recap, onClose, onChanged, onNotify }: RecapSharePanelProps) {
  const [visibility, setVisibility] = useState<RecapVisibility>(recap.visibility);
  const [expiryDays, setExpiryDays] = useState("30");
  const [generated, setGenerated] = useState<RecapShareLink | null>(null);
  const [busy, setBusy] = useState<null | "visibility" | "generate" | "revoke" | "privacy" | "pdf">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hideEndpoints, setHideEndpoints] = useState(recap.hide_endpoints);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const theme = accentTheme(recap.theme_accent);
  const cover = resolveRecapMediaUrl(recap.cover_photo?.thumbnail_url ?? recap.cover_photo?.url);
  const visiblePhotos = recap.photos.filter((photo) => !photo.is_hidden);
  const shareUrl = generated?.url ?? null;
  const expiryLabel = generated?.expires_at
    ? formatRecapDate(generated.expires_at)
    : recap.share.expires_at
      ? formatRecapDate(recap.share.expires_at)
      : null;

  const changeVisibility = async (next: RecapVisibility) => {
    setVisibility(next);
    setBusy("visibility");
    setError(null);
    try {
      const updated = await updateTripRecap(recap.itinerary_id, { visibility: next });
      await onChanged(updated);
      if (next === "link" || next === "public") {
        onNotify?.(
          recap.share.active
            ? "Visibility updated."
            : "Visibility updated. Generate a link to make it reachable.",
        );
      }
    } catch (err) {
      setError(apiError(err));
      setVisibility(recap.visibility);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("generate");
    setError(null);
    setCopied(false);
    try {
      const link = await createRecapShareLink(recap.itinerary_id, Number(expiryDays));
      setGenerated(link);
      setVisibility(link.visibility);
      await onChanged();
      onNotify?.("Share link ready. Copy it now — it is only shown once.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onNotify?.("Link copied.");
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it manually.");
    }
  };

  const shareNative = async () => {
    if (!shareUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: recap.title, text: `Our trip recap: ${recap.title}`, url: shareUrl });
      } catch {
        // User dismissed the share sheet; nothing to do.
      }
      return;
    }
    await copy();
  };

  const revoke = async () => {
    setBusy("revoke");
    setError(null);
    try {
      await revokeRecapShareLink(recap.itinerary_id);
      setGenerated(null);
      setVisibility("private");
      setConfirmRevoke(false);
      await onChanged();
      onNotify?.("Share link revoked. Existing copies no longer work.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  const savePrivacy = async (next: boolean) => {
    setHideEndpoints(next);
    setBusy("privacy");
    setError(null);
    try {
      const updated = await updateTripRecap(recap.itinerary_id, { hide_endpoints: next });
      await onChanged(updated);
    } catch (err) {
      setError(apiError(err));
      setHideEndpoints(recap.hide_endpoints);
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy("pdf");
    setError(null);
    try {
      const slug = recap.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lakbai-trip";
      await downloadRecapExport(recap.itinerary_id, slug);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this recap"
      description="You choose what the world sees. Private details never leave the member view."
      size="lg"
      busy={busy !== null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
            Done
          </Button>
          <Button variant="dark" onClick={() => void downloadPdf()} disabled={busy !== null}>
            {busy === "pdf" ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
            Download PDF
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-ink-900">Who can see it</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {VISIBILITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void changeVisibility(option.value)}
                    disabled={busy !== null}
                    aria-pressed={visibility === option.value}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60",
                      visibility === option.value
                        ? "border-lagoon-900 bg-lagoon-900 text-sand-50"
                        : "border-line bg-white/60 text-ink-800 hover:bg-sand-50",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {option.label}
                      {visibility === option.value ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className={cn("mt-0.5 block text-[11px]", visibility === option.value ? "text-sand-50/70" : "text-ink-600")}>
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-900">Public link</h3>

              {shareUrl ? (
                <div className="space-y-2 rounded-xl bg-sand-50 p-3 ring-1 ring-inset ring-line/70">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sea-600">Copy it now — shown once</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-10 min-w-0 flex-1 rounded-lg bg-white px-3 text-xs text-ink-900 ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none"
                      aria-label="Public recap link"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void copy()}>
                        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void shareNative()}>
                        <ShareIcon className="h-4 w-4" />
                        Share
                      </Button>
                    </div>
                  </div>
                  {generated?.expires_at ? (
                    <p className="text-[11px] text-ink-600">Expires {formatRecapDate(generated.expires_at)}.</p>
                  ) : null}
                </div>
              ) : recap.share.has_link && recap.share.active ? (
                <div className="space-y-2 rounded-xl bg-sand-50 p-3 ring-1 ring-inset ring-line/70">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-lagoon-900">
                    <ShieldIcon className="h-4 w-4 text-sea-600" />
                    A link is active
                  </p>
                  <p className="text-xs text-ink-600">
                    {expiryLabel ? `Expires ${expiryLabel}. ` : "No expiry set. "}
                    For security, the raw URL is never stored, so it can't be shown again. Regenerate to get a fresh copy — the
                    old link stops working.
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmRevoke(true)} disabled={busy !== null}>
                    Revoke link
                  </Button>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3 py-3 text-xs text-ink-600">
                  No active link yet. Generate one to let anyone open the safe public view without signing in.
                </p>
              )}

              <div className="flex flex-wrap items-end gap-2 pt-1">
                <Select
                  aria-label="Link expiry"
                  label="Link expires"
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(event.target.value)}
                  options={EXPIRY_OPTIONS}
                  className="h-9 min-w-32 text-xs"
                />
                <Button size="sm" onClick={() => void generate()} disabled={busy !== null}>
                  {busy === "generate" ? <Spinner className="h-4 w-4" /> : <ShareIcon className="h-4 w-4" />}
                  {recap.share.has_link ? "Regenerate link" : "Generate link"}
                </Button>
              </div>

              {confirmRevoke ? (
                <div className="rounded-xl bg-red-50 p-3 ring-1 ring-inset ring-red-200">
                  <p className="text-sm font-semibold text-red-800">Revoke the current link?</p>
                  <p className="mt-1 text-xs text-red-700">Anyone with the old URL will see a 404 immediately.</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => void revoke()} disabled={busy !== null}>
                      {busy === "revoke" ? <Spinner className="h-3.5 w-3.5" /> : null}
                      Revoke
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmRevoke(false)} disabled={busy !== null}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-2xl bg-sand-50 p-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideEndpoints}
                  disabled={busy !== null}
                  onClick={() => void savePrivacy(!hideEndpoints)}
                  className={cn(
                    "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60",
                    hideEndpoints ? "bg-surf-400" : "bg-sand-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      hideEndpoints ? "translate-x-[18px]" : "translate-x-0.5",
                    )}
                  />
                </button>
                <div>
                  <p className="text-sm font-semibold text-ink-900">Hide exact start and end</p>
                  <p className="text-xs text-ink-600">
                    Recommended. Removes about 300 m from each end of the published route, so your home or hotel isn't exposed.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">What stays private</p>
                <ul className="mt-1 grid gap-1 text-[11px] text-ink-700 sm:grid-cols-2">
                  <li>Emails and member identities</li>
                  <li>Notes and budgets</li>
                  <li>Live location and meetups</li>
                  <li>Exact route endpoints and hidden photos</li>
                </ul>
              </div>
            </section>
          </div>

          <aside className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              <MapIcon className="h-3.5 w-3.5" />
              Live public preview
            </p>
            <div className="overflow-hidden rounded-2xl bg-lagoon-900 text-sand-50 shadow-lg">
              <div className="relative aspect-[4/3] bg-lagoon-800">
                {cover ? <img src={cover} alt="" className="h-full w-full object-cover opacity-80" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-lagoon-950/90 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-2 font-display text-lg font-semibold leading-snug text-white">{recap.title}</p>
                  <p className="mt-0.5 text-[10px] text-sand-50/75">
                    {recap.day_count === 1 ? "1 day" : `${recap.day_count} days`} ·{" "}
                    {recap.member_count === 1 ? "Solo" : `${recap.member_count} travellers`}
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-3">
                {recap.summary ? <p className="line-clamp-3 text-[11px] leading-relaxed text-sand-50/80">{recap.summary}</p> : null}

                {recap.show_stats && recap.stats ? (
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <PreviewStat label="Distance" value={formatDistance(recap.stats.distance_m) ?? "0 m"} />
                    <PreviewStat label="Time" value={formatDuration(recap.stats.elapsed_seconds)} />
                    <PreviewStat label="Stops" value={`${recap.stats.stops_visited ?? 0} / ${recap.stats.stops_total ?? 0}`} />
                    {recap.stats.spend_estimated !== null && recap.stats.spend_estimated !== undefined ? (
                      <PreviewStat label="Spend" value={formatMoney(recap.stats.spend_estimated)} />
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[10px] text-sand-50/50">Stats hidden on the public page.</p>
                )}

                {recap.show_photos && visiblePhotos.length > 0 ? (
                  <div className="flex -space-x-1.5">
                    {visiblePhotos.slice(0, 4).map((photo) => (
                      <img
                        key={photo.id}
                        src={resolveRecapMediaUrl(photo.thumbnail_url) ?? undefined}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover ring-2 ring-lagoon-900"
                        loading="lazy"
                      />
                    ))}
                    {visiblePhotos.length > 4 ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[9px] font-semibold ring-2 ring-lagoon-900">
                        +{visiblePhotos.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[10px] text-sand-50/50">Photos hidden on the public page.</p>
                )}

                <div className="flex flex-wrap gap-1">
                  <Badge tone="mango">{hideEndpoints ? "Start/end hidden" : "Full route"}</Badge>
                  {recap.show_photos ? <Badge tone="sea">{visiblePhotos.length} photos</Badge> : null}
                </div>

                <p className={cn("text-[10px]", theme.text)}>Plan your own trip on Lakbai</p>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-ink-500">
              Preview mirrors the public whitelist. The real page is server-rate-limited and never receives private fields.
            </p>
          </aside>
        </div>
      </div>
    </Modal>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1">
      <p className="uppercase tracking-wide text-sand-50/55">{label}</p>
      <p className="font-semibold text-sand-50">{value}</p>
    </div>
  );
}
