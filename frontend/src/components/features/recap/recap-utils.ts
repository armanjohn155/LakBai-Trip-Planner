import { API_ORIGIN } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { RecapAccent } from "@/lib/types";

/**
 * Photo and destination URLs may be absolute (Laravel's asset()) or relative
 * `/storage/...` paths. Normalise both so the SPA, which can be served from a
 * different origin than the API, always resolves media correctly.
 */
export function resolveRecapMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/storage/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("storage/")) return `${API_ORIGIN}/${url}`;
  return url;
}

export interface AccentTheme {
  /** Solid accent for small marks and filled buttons. */
  bg: string;
  /** Accent text colour. */
  text: string;
  /** Soft tint behind chips and stat cards. */
  soft: string;
  /** Ring/border accent. */
  ring: string;
  /** Gradient overlay for the recap hero. */
  gradient: string;
}

const accents: Record<RecapAccent, AccentTheme> = {
  surf: {
    bg: "bg-surf-400",
    text: "text-surf-400",
    soft: "bg-surf-400/10",
    ring: "ring-surf-400/30",
    gradient: "from-lagoon-950/85 via-lagoon-900/35 to-surf-400/20",
  },
  mango: {
    bg: "bg-mango-400",
    text: "text-mango-500",
    soft: "bg-mango-400/15",
    ring: "ring-mango-400/35",
    gradient: "from-lagoon-950/85 via-lagoon-900/35 to-mango-400/25",
  },
  magenta: {
    bg: "bg-sinulog-magenta",
    text: "text-sinulog-magenta",
    soft: "bg-sinulog-magenta/10",
    ring: "ring-sinulog-magenta/25",
    gradient: "from-lagoon-950/85 via-lagoon-900/35 to-sinulog-magenta/25",
  },
  sea: {
    bg: "bg-sea-500",
    text: "text-sea-600",
    soft: "bg-sea-500/10",
    ring: "ring-sea-500/25",
    gradient: "from-lagoon-950/85 via-lagoon-900/35 to-sea-500/25",
  },
  royal: {
    bg: "bg-royal-600",
    text: "text-royal-600",
    soft: "bg-royal-600/10",
    ring: "ring-royal-600/25",
    gradient: "from-lagoon-950/85 via-lagoon-900/35 to-royal-500/25",
  },
};

export function accentTheme(accent: RecapAccent | null | undefined): AccentTheme {
  return accents[accent ?? "surf"] ?? accents.surf;
}

export function accentGradient(accent: RecapAccent | null | undefined, className?: string): string {
  return cn("bg-gradient-to-tr", accentTheme(accent).gradient, className);
}

/** "3h 05m" / "42m" / "30s" for tracked time. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds ?? 0)));
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

const timeFormatter = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

/** Local clock time for a stop timestamp, e.g. "9:41 AM". */
export function formatRecapTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return timeFormatter.format(date);
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" });

export function formatRecapDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

/** Group consecutive stops into day buckets without mutating the source. */
export function groupStopsByDay<T extends { day_number: number; order: number }>(stops: T[]): Array<{ day: number; stops: T[] }> {
  const days = new Map<number, T[]>();
  for (const stop of [...stops].sort((a, b) => a.day_number - b.day_number || a.order - b.order)) {
    const bucket = days.get(stop.day_number) ?? [];
    bucket.push(stop);
    days.set(stop.day_number, bucket);
  }
  return [...days.entries()].map(([day, group]) => ({ day, stops: group }));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}

export function stopAnchorId(stopId: number): string {
  return `recap-stop-${stopId}`;
}
