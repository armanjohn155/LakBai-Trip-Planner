import type { Destination } from "@/lib/types";
import { toNumber } from "@/lib/format";

export interface DraftItem {
  uid: string;
  destination: Destination;
  dayIndex: number;
  order: number;
  estimated_budget: string;
  notes: string;
}

export interface TripDraft {
  title: string;
  startDate: string;
  endDate: string;
  budget: string;
  noBudgetLimit: boolean;
  items: DraftItem[];
}

const STORAGE_KEY = "suroy.trip-draft.v1";

let uidCounter = 0;

export const nextUid = (): string => `${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

export const emptyTripDraft = (): TripDraft => ({
  title: "",
  startDate: "",
  endDate: "",
  budget: "",
  noBudgetLimit: false,
  items: [],
});

export const hasDraftData = (draft: TripDraft): boolean =>
  draft.title.trim() !== "" ||
  draft.startDate !== "" ||
  draft.endDate !== "" ||
  draft.budget !== "" ||
  draft.noBudgetLimit ||
  draft.items.length > 0;

export function persistDraft(draft: TripDraft, step: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step }));
  } catch {
    // Storage can be unavailable (private mode, quota) — the wizard still works in memory.
  }
}

export function restoreDraft(): { draft: TripDraft; step: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: Partial<TripDraft>; step?: number };
    if (!parsed.draft) return null;
    return {
      draft: { ...emptyTripDraft(), ...parsed.draft, items: parsed.draft.items ?? [] },
      step: typeof parsed.step === "number" ? Math.min(Math.max(parsed.step, 1), 3) : 1,
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return days < 0 ? 0 : days + 1;
}

export const isValidDateRange = (startDate: string, endDate: string): boolean => inclusiveDayCount(startDate, endDate) > 0;

export function formatDateShort(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function suggestedDraftTitle(draft: TripDraft): string {
  return `Cebu Trip – ${draft.startDate}–${draft.endDate}`;
}

export function draftItemTotal(items: DraftItem[]): number {
  return items.reduce((total, item) => total + toNumber(item.estimated_budget), 0);
}

export interface DraftBudgetBreakdown {
  category: string;
  item_count: number;
  estimated_budget: number;
}

export function draftBudgetBreakdown(items: DraftItem[]): DraftBudgetBreakdown[] {
  const buckets = new Map<string, DraftBudgetBreakdown>();
  for (const item of items) {
    const category = item.destination.category || "Other";
    const entry = buckets.get(category) ?? { category, item_count: 0, estimated_budget: 0 };
    entry.item_count += 1;
    entry.estimated_budget += toNumber(item.estimated_budget);
    buckets.set(category, entry);
  }
  return Array.from(buckets.values()).sort((a, b) => b.estimated_budget - a.estimated_budget);
}