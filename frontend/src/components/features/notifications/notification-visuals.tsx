import type { ReactNode } from "react";

import { notificationGroup } from "@/components/features/notifications/notification-utils";
import { cn } from "@/lib/cn";
import type { NotificationType } from "@/lib/notification-types";

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function NotificationTypeIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const group = notificationGroup(type);

  if (group === "friends") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...iconProps} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (group === "trips") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...iconProps} aria-hidden="true">
        <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (group === "reviews") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...iconProps} aria-hidden="true">
        <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.4l6.1-.9z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} {...iconProps} aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

type Actor = { name?: unknown; avatar_url?: unknown };

function readActor(data: Record<string, unknown>): Actor | null {
  const actor = data.actor;
  if (actor && typeof actor === "object") {
    return actor as Actor;
  }
  return null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NotificationAvatar({
  data,
  fallbackIcon,
  className,
}: {
  data: Record<string, unknown>;
  fallbackIcon?: ReactNode;
  className?: string;
}) {
  const actor = readActor(data);
  const name = typeof actor?.name === "string" ? actor.name : "";
  const src = typeof actor?.avatar_url === "string" && actor.avatar_url ? actor.avatar_url : null;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  if (name) {
    return (
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surf-400/15 text-xs font-bold text-lagoon-900",
          className,
        )}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand-100 text-ink-600",
        className,
      )}
      aria-hidden="true"
    >
      {fallbackIcon}
    </span>
  );
}
