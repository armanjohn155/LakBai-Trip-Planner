import type { ItineraryItemStatus } from "@/lib/types";
import { DESTINATION_CATEGORIES } from "@/lib/destination-constants";

/** Extra categories available only to custom (destination-less) stops. */
export const CUSTOM_STOP_CATEGORIES = ["Transport", "Accommodation", "Meal", "Other"] as const;

/** Every category a stop may carry: destination categories + custom ones. */
export const STOP_CATEGORIES: string[] = [...DESTINATION_CATEGORIES, ...CUSTOM_STOP_CATEGORIES];

export const STOP_STATUSES: ItineraryItemStatus[] = ["planned", "done", "skipped"];

export const STOP_STATUS_LABEL: Record<ItineraryItemStatus, string> = {
  planned: "Planned",
  done: "Done",
  skipped: "Skipped",
};

export const STOP_STATUS_TONE: Record<ItineraryItemStatus, "surf" | "mango" | "neutral"> = {
  planned: "surf",
  done: "mango",
  skipped: "neutral",
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
