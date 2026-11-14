import type { ItineraryItemStatus, TripLifecycleStatus } from "@/lib/types";
import { DESTINATION_CATEGORIES } from "@/lib/destination-constants";

/** Extra categories available only to custom (destination-less) stops. */
export const CUSTOM_STOP_CATEGORIES = ["Transport", "Accommodation", "Meal", "Other"] as const;

/** Every category a stop may carry: destination categories + custom ones. */
export const STOP_CATEGORIES: string[] = [...DESTINATION_CATEGORIES, ...CUSTOM_STOP_CATEGORIES];

export const STOP_STATUSES: ItineraryItemStatus[] = ["planned", "arrived", "done", "skipped"];

export const STOP_STATUS_LABEL: Record<ItineraryItemStatus, string> = {
  planned: "Planned",
  arrived: "Arrived",
  done: "Done",
  skipped: "Skipped",
};

export const STOP_STATUS_TONE: Record<ItineraryItemStatus, "surf" | "mango" | "neutral"> = {
  planned: "surf",
  arrived: "surf",
  done: "mango",
  skipped: "neutral",
};

export const LIFECYCLE_LABEL: Record<TripLifecycleStatus, string> = {
  planned: "Planned",
  active: "Live",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const LIFECYCLE_TONE: Record<TripLifecycleStatus, "surf" | "mango" | "sea" | "neutral"> = {
  planned: "neutral",
  active: "surf",
  paused: "mango",
  completed: "sea",
  cancelled: "neutral",
};

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatTimeRange(startTime: string | null | undefined, durationMinutes: number | null | undefined): string | null {
  if (!startTime) return null;
  const [hour, minute] = startTime.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  const start = `${pad(hour)}:${pad(minute)}`;
  if (!durationMinutes || durationMinutes <= 0) return start;

  const totalMinutes = hour * 60 + minute + durationMinutes;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${start} – ${pad(endHour)}:${pad(endMinute)}`;
}

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** "Saturday, Oct 22, 2026" when the trip has a start date, else null. */
export function formatDayHeading(startDate: string | null | undefined, dayNumber: number): string | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const date = new Date(start);
  date.setDate(date.getDate() + Math.max(dayNumber - 1, 0));
  return weekdayFormatter.format(date);
}

/** A compact date range for the map overlay, e.g. "Oct 22 – Oct 24, 2026". */
export function formatTripDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate && !endDate) return null;
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
  const valid = (value: Date | null): value is Date => value !== null && !Number.isNaN(value.getTime());

  if (valid(start) && valid(end)) {
    const year = end.getFullYear();
    return `${shortDateFormatter.format(start)} – ${shortDateFormatter.format(end)}, ${year}`;
  }
  if (valid(start)) return `${shortDateFormatter.format(start)}, ${start.getFullYear()}`;
  if (valid(end)) return `${shortDateFormatter.format(end)}, ${end.getFullYear()}`;
  return null;
}
