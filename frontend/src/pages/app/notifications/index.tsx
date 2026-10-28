import { useEffect, useState } from "react";

import {
  NotificationAvatar,
  NotificationTypeIcon,
} from "@/components/features/notifications/notification-visuals";
import { formatRelativeTime } from "@/components/features/notifications/notification-utils";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/cn";

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const { items, loading, error, hasMore, refresh, loadMore, markRead, markAllRead, remove, clearRead } =
    useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = filter === "unread" ? items.filter((item) => !item.read) : items;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-lagoon-900 sm:text-3xl">Notifications</h1>
          <p className="text-sm text-ink-600">Stay up to date with trips, friends, and reviews.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={!items.some((item) => !item.read)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark all as read
          </button>
          <button
            type="button"
            onClick={() => void clearRead()}
            disabled={!items.some((item) => item.read)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear read
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2" role="tablist" aria-label="Filter notifications">
        {(["all", "unread"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              filter === value ? "bg-surf-400/15 text-lagoon-900" : "text-ink-700 hover:bg-sand-100",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {loading && visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-600">Loading notifications…</p>
        ) : error && visible.length === 0 ? (
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
        ) : visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-600">You&apos;re all caught up</p>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
                !n.read && "bg-sand-50/40",
              )}
            >
              <div className="flex min-w-0 gap-3">
                <NotificationAvatar
                  data={n.data}
                  className="mt-0.5"
                  fallbackIcon={<NotificationTypeIcon type={n.type} className="h-4 w-4" />}
                />
                <div className="min-w-0 space-y-1">
                  <p className={cn("text-sm text-ink-900", !n.read && "font-semibold")}>{n.message}</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-500">
                    <NotificationTypeIcon type={n.type} className="h-3 w-3" />
                    {formatRelativeTime(n.created_at)}
                  </p>
                  {!n.actionable && (n.type === "friend.request_received" || n.type === "trip.invite_received") ? (
                    <p className="text-xs text-ink-500">No longer available</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!n.read ? (
                  <button
                    type="button"
                    onClick={() => void markRead(n.id)}
                    className="rounded-full px-3 py-1 text-xs font-medium text-ink-700 hover:bg-sand-100"
                  >
                    Mark read
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void remove(n.id)}
                  className="rounded-full px-3 py-1 text-xs font-medium text-sinulog-red hover:bg-sinulog-red/5"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
