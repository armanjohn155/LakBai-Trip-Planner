import { useEffect, useState } from "react";

import { ClockIcon, PinIcon, RouteIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";
import type { TripLifecycleStatus, TripTrackingSummary } from "@/lib/types";

interface TripLiveBarProps {
  lifecycle: TripLifecycleStatus;
  summary: TripTrackingSummary | null;
  startedAt?: string | null;
  totalPausedSeconds?: number;
  isMobile: boolean;
  bottomOffset: number;
  centerOffset: number;
  busy?: boolean;
  message?: string | null;
  wakeLockNotice?: string | null;
  pendingCount?: number;
  canFinish?: boolean;
  canManage?: boolean;
  following?: boolean;
  group?: TripLiveBarGroup | null;
  routeDistanceM?: number | null;
  routeDurationS?: number | null;
  routeApproximate?: boolean;
  routeLoading?: boolean;
  routeHint?: string | null;
  routeRetry?: (() => void) | null;
  locationStatus?: string | null;
  onToggleFollow?: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

export interface TripLiveBarGroup {
  sharing: boolean;
  sharingCount: number;
  memberCount: number;
  transport: "live" | "connecting" | "polling" | "off";
}

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function TripLiveBar({
  lifecycle,
  summary,
  startedAt = null,
  totalPausedSeconds = 0,
  isMobile,
  bottomOffset,
  centerOffset,
  busy = false,
  message,
  wakeLockNotice,
  pendingCount = 0,
  canFinish = false,
  canManage = true,
  following = false,
  group = null,
  routeDistanceM = null,
  routeDurationS = null,
  routeApproximate = false,
  routeLoading = false,
  routeHint = null,
  routeRetry = null,
  locationStatus = null,
  onToggleFollow,
  onPause,
  onResume,
  onFinish,
}: TripLiveBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lifecycle !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [lifecycle]);

  if (lifecycle !== "active" && lifecycle !== "paused") return null;

  const startedAtMs = startedAt !== null ? new Date(startedAt).getTime() : Number.NaN;
  const elapsed =
    lifecycle === "active" && Number.isFinite(startedAtMs)
      ? Math.max(0, (now - startedAtMs) / 1_000 - Math.max(0, totalPausedSeconds))
      : summary?.elapsed_seconds ?? 0;
  const distance = summary?.distance_m ?? 0;
  const nextStop = summary?.next_stop ?? null;
  const nextDistance = nextStop?.distance_m != null ? formatDistance(nextStop.distance_m) : null;
  const isPaused = lifecycle === "paused";
  const routeLooksValid = routeDistanceM != null && routeDurationS != null
    && Number.isFinite(routeDistanceM) && routeDistanceM >= 0 && routeDistanceM < 10_000_000
    && Number.isFinite(routeDurationS) && routeDurationS >= 0 && routeDurationS < 14 * 24 * 3600;
  const routeHours = routeLooksValid ? Math.floor((routeDurationS ?? 0) / 3600) : 0;
  const routeMinutes = routeLooksValid ? Math.max(1, Math.round(((routeDurationS ?? 0) % 3600) / 60)) : 0;
  const routeEta = routeHours > 0 ? `${routeHours} h ${routeMinutes} min` : `${routeMinutes} min`;

  const notice = message ?? wakeLockNotice ?? (pendingCount > 0 ? `${pendingCount} location updates queued` : null);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-[890] w-[min(94vw,42rem)] -translate-x-1/2",
        isMobile ? "" : "top-3 sm:top-4",
      )}
      style={
        isMobile
          ? { bottom: bottomOffset + 12 }
          : { left: `calc(50% + ${centerOffset}px)` }
      }
    >
      <div className="pointer-events-auto overflow-hidden rounded-2xl bg-white/95 shadow-xl ring-1 ring-line/60 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-lagoon-900">
            <span
              className={cn(
                "relative flex h-2.5 w-2.5 rounded-full",
                isPaused ? "bg-mango-500" : "bg-emerald-500",
              )}
              aria-hidden="true"
            >
              {!isPaused ? <span className="trip-live-dot absolute inset-0 rounded-full bg-emerald-500" /> : null}
            </span>
            {isPaused ? "Paused" : "Live"}
          </span>

          {group ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  group.sharing ? "bg-emerald-50 text-emerald-700" : "bg-sand-100 text-ink-600",
                )}
                title={group.sharing ? "Accepted members can see your latest location" : "Your location is private"}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", group.sharing ? "bg-emerald-500" : "bg-ink-400")}
                  aria-hidden="true"
                />
                {group.sharing ? `Sharing ${group.sharingCount}/${group.memberCount}` : "Not sharing"}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600"
                title={
                  group.transport === "live"
                    ? "WebSocket updates are connected"
                    : "Falling back to the 10-second polling endpoint"
                }
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    group.transport === "live"
                      ? "bg-emerald-500"
                      : group.transport === "connecting"
                        ? "bg-mango-500"
                        : "bg-ink-400",
                  )}
                  aria-hidden="true"
                />
                {group.transport === "live"
                  ? "Live updates"
                  : group.transport === "connecting"
                    ? "Connecting…"
                    : group.transport === "polling"
                      ? "Polling"
                      : "Tracking off"}
              </span>
            </>
          ) : null}

          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-700" title="Elapsed time">
            <ClockIcon className="h-3.5 w-3.5 text-ink-500" /> {formatElapsed(elapsed)}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-700" title="Distance travelled">
            <RouteIcon className="h-3.5 w-3.5 text-ink-500" /> {(distance / 1000).toFixed(1)} km
          </span>

          {nextStop ? (
            <span
              className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink-700"
              title={`Next: ${nextStop.title}`}
            >
              <PinIcon className="h-3.5 w-3.5 shrink-0 text-sea-600" />
              <span className="max-w-[9rem] truncate">{nextStop.title}</span>
              {nextDistance ? <span className="shrink-0 text-ink-500">· {nextDistance}</span> : null}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-ink-500">No stops remaining</span>
          )}

          {routeLooksValid ? (
            <span className={cn("inline-flex items-center gap-1 rounded-full bg-surf-400/10 px-2 py-0.5 text-[10px] font-semibold text-sea-700", routeLoading && "animate-pulse")} aria-live="polite">
              {routeApproximate ? "Approx. " : ""}{formatDistance(routeDistanceM)} · {routeEta}
            </span>
          ) : null}
          {routeLoading && !routeLooksValid ? <span className="animate-pulse rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">Finding road route…</span> : null}
          {locationStatus ? <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-ink-600">{locationStatus}</span> : null}
          {routeHint ? <span className="basis-full text-[10px] font-medium text-mango-800">{routeHint}</span> : null}
          {routeRetry ? (
            <button type="button" onClick={routeRetry} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-sea-700 hover:bg-surf-400/10">Retry route</button>
          ) : null}

          {onToggleFollow ? (
            <button
              type="button"
              onClick={onToggleFollow}
              aria-pressed={following}
              className={cn(
                "hidden rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors sm:inline-flex",
                following ? "bg-surf-400/15 text-sea-600" : "text-ink-500 hover:bg-sand-100",
              )}
            >
              Follow me
            </button>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {canManage ? (
              <>
                {isPaused ? (
                  <Button size="sm" onClick={onResume} disabled={busy}>
                    Resume
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={onPause} disabled={busy}>
                    Pause
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={canFinish ? "dark" : "secondary"}
                  onClick={onFinish}
                  disabled={busy}
                  title={canFinish ? "Every stop is handled - finish the trip" : "Finish early"}
                >
                  Finish
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {notice ? (
          <p
            className={cn(
              "border-t border-line/50 px-3 py-1 text-[10px] font-medium",
              isPaused ? "bg-mango-400/10 text-ink-700" : "bg-sand-50 text-ink-600",
            )}
            role="status"
          >
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
