import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  NotificationAvatar,
  NotificationTypeIcon,
} from "@/components/features/notifications/notification-visuals";
import { formatRelativeTime } from "@/components/features/notifications/notification-utils";
import { useNotifications } from "@/hooks/use-notifications";
import { acceptFriendRequest, acceptPendingInvitation, declineFriendRequest, declinePendingInvitation, getFriendRequests } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/notification-types";

function isGone(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("response" in error)) return false;
  const status = (error as { response?: { status?: number } }).response?.status;
  return status === 404 || status === 410;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: number; data?: { message?: unknown } } }).response;
    if (response?.status === 404 || response?.status === 410) {
      return "No longer available";
    }
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Something went wrong. Try again.";
}

export function NotificationBell() {
  const { unreadCount, items, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    void refresh();

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, refresh]);

  const latest = items.slice(0, 10);
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);
  const ariaLabel = `Notifications, ${unreadCount} unread`;

  const isFriendRequest = (n: AppNotification) => n.type === "friend.request_received";
  const isTripInvite = (n: AppNotification) => n.type === "trip.invite_received";
  const isActionable = (n: AppNotification) => n.actionable && !unavailable[n.id];

  const handleItemClick = async (n: AppNotification) => {
    try {
      if (!n.read) {
        await markRead(n.id);
      }
    } catch {
      // Optimistic state was rolled back; stay on the panel.
    }

    if (n.action_url && n.action_url.startsWith("/")) {
      setOpen(false);
      navigate(n.action_url);
    }
  };

  const findFriendshipId = async (n: AppNotification): Promise<number | null> => {
    const data = n.data as Record<string, unknown>;
    if (typeof data.friendship_id === "number") return data.friendship_id;

    const requesterId = (data.actor as { id?: unknown } | undefined)?.id;
    const requests = await getFriendRequests("incoming");
    const match = requests.find((request) =>
      typeof requesterId === "number" ? request.requester_id === requesterId : false,
    );
    return match?.id ?? null;
  };

  const runAction = async (n: AppNotification, action: () => Promise<void>) => {
    setActingId(n.id);
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[n.id];
      return next;
    });

    try {
      await action();
      if (!n.read) {
        await markRead(n.id);
      }
    } catch (err) {
      if (isGone(err)) {
        setUnavailable((prev) => ({ ...prev, [n.id]: true }));
      } else {
        setItemErrors((prev) => ({ ...prev, [n.id]: errorMessage(err) }));
      }
    } finally {
      setActingId(null);
    }
  };

  const handleFriendAction = (n: AppNotification, accept: boolean) =>
    runAction(n, async () => {
      const friendshipId = await findFriendshipId(n);
      if (friendshipId === null) {
        throw { response: { status: 404 } };
      }
      await (accept ? acceptFriendRequest(friendshipId) : declineFriendRequest(friendshipId));
    });

  const handleTripAction = (n: AppNotification, accept: boolean) =>
    runAction(n, async () => {
      const data = n.data as Record<string, unknown>;
      const itineraryId = data.itinerary_id;
      if (typeof itineraryId !== "number") {
        throw { response: { status: 404 } };
      }
      await (accept ? acceptPendingInvitation(itineraryId) : declinePendingInvitation(itineraryId));
    });

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-sand-100 hover:text-ink-900"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "z-[1200] overflow-hidden border border-line bg-white text-ink-900 shadow-xl",
            "fixed inset-x-0 top-16 max-h-[calc(100vh-4rem)] rounded-none border-x-0 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] sm:max-h-[520px] sm:rounded-2xl",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <p className="text-sm font-semibold text-lagoon-900">Notifications</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-ink-600 transition-colors hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>
          <div className="h-px bg-line" />

          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto sm:max-h-[380px]">
            {loading && latest.length === 0 ? (
              <div className="space-y-2 p-3" aria-hidden="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex animate-pulse items-start gap-3 rounded-xl p-2">
                    <span className="h-9 w-9 shrink-0 rounded-full bg-sand-100" />
                    <span className="flex-1 space-y-2 py-1">
                      <span className="block h-3 w-3/4 rounded bg-sand-100" />
                      <span className="block h-2.5 w-1/3 rounded bg-sand-100" />
                    </span>
                  </div>
                ))}
              </div>
            ) : error && latest.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <p className="text-sm text-ink-600">{error}</p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-full bg-surf-400 px-4 py-1.5 text-xs font-semibold text-white hover:bg-surf-300"
                >
                  Retry
                </button>
              </div>
            ) : latest.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-600">You&apos;re all caught up</p>
            ) : (
              latest.map((n) => {
                const actionable = isActionable(n);
                const busy = actingId === n.id;

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors",
                      !n.read && "bg-sand-50/50",
                    )}
                  >
                    <NotificationAvatar
                      data={n.data as Record<string, unknown>}
                      className="mt-0.5"
                      fallbackIcon={<NotificationTypeIcon type={n.type} className="h-4 w-4" />}
                    />

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => void handleItemClick(n)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm text-ink-900", !n.read && "font-semibold")}>
                            {n.message}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500">
                            <NotificationTypeIcon type={n.type} className="h-3 w-3" />
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </span>
                        {!n.read ? (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500"
                            aria-label="Unread"
                          />
                        ) : null}
                      </button>

                      {!actionable && (isFriendRequest(n) || isTripInvite(n)) ? (
                        <p className="mt-1.5 text-xs text-ink-500">No longer available</p>
                      ) : null}

                      {actionable && (isFriendRequest(n) || isTripInvite(n)) ? (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void (isFriendRequest(n) ? handleFriendAction(n, true) : handleTripAction(n, true))
                            }
                            className="rounded-full bg-surf-400 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-surf-300 disabled:cursor-wait disabled:opacity-60"
                          >
                            {busy ? "Accepting…" : "Accept"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void (isFriendRequest(n) ? handleFriendAction(n, false) : handleTripAction(n, false))
                            }
                            className="rounded-full px-3 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                      ) : null}

                      {itemErrors[n.id] ? (
                        <p className="mt-1.5 text-xs text-sinulog-red">{itemErrors[n.id]}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="h-px bg-line" />
          <div className="flex items-center justify-center px-4 py-2">
            <Link
              to="/app/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-lagoon-900 hover:underline"
            >
              See all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
