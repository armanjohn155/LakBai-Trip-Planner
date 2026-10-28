import type { NotificationType } from "@/lib/notification-types";

export type NotificationGroup = "friends" | "trips" | "reviews" | "other";

export function notificationGroup(type: NotificationType): NotificationGroup {
  if (type.startsWith("friend.")) return "friends";
  if (type.startsWith("trip.")) return "trips";
  if (type.startsWith("review.")) return "reviews";
  return "other";
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
