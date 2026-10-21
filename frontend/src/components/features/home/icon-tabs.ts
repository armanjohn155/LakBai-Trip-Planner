/**
 * Shared tab contract for the homepage feature section.
 *
 * ICON_ORDER is the single source of truth for tab/panel order. Adding a new
 * tab means adding its action here (and its panel to PANEL_DEFINITIONS in
 * feature-section.tsx); indexes are derived, never hard-coded.
 */
export type IconAction = "map" | "route" | "pricing" | "list" | "assistant";

export const ICON_ORDER: IconAction[] = ["map", "route", "pricing", "list", "assistant"];
