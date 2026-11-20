/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { MapIcon, PinIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";
import { CUSTOM_STOP_CATEGORIES } from "@/components/features/itinerary/itinerary-constants";
import { cn } from "@/lib/cn";
import { useDestinationOptions } from "@/lib/destination-options";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

export type AddStopMode = "destination" | "custom";
export type AddStopMobileSnap = "half" | "full";

/** Height of the mobile add-stop sheet for each snap point. */
export function addStopSheetHeight(snap: AddStopMobileSnap, viewportHeight: number, bottomInset = 0): number {
  const available = Math.max(viewportHeight - 64 - bottomInset, 260);
  return Math.round(available * (snap === "full" ? 0.92 : 0.56));
}

export interface CustomStopInput {
  title: string;
  address: string;
  category: string;
  startTime: string;
  duration: string;
  budget: string;
  latitude: number;
  longitude: number;
}

interface AddStopPanelProps {
  isMobile: boolean;
  width: number;
  destinations: Destination[];
  filteredDestinations: Destination[];
  destinationsLoading: boolean;
  destinationsError: string | null;
  addedDestinationIds: Set<number>;
  hoveredDestinationId: number | null;
  mode: AddStopMode;
  selectedDay: number;
  maxDay: number;
  startTime: string;
  category: string | null;
  adding: boolean;
  addError: string | null;
  sessionCount: number;
  pickedPoint: { lat: number; lng: number } | null;
  mobileSnap: AddStopMobileSnap;
  mobileHeight: number;
  mobileBottomInset?: number;
  onClose: () => void;
  onRetryDestinations: () => void;
  onModeChange: (mode: AddStopMode) => void;
  onSelectedDayChange: (day: number) => void;
  onNewDay: () => void;
  onStartTimeChange: (value: string) => void;
  onCategoryChange: (category: string | null) => void;
  onSearchChange: (value: string) => void;
  onHoverDestination: (id: number | null) => void;
  onAddDestination: (destination: Destination) => void;
  onAddCustomStop: (input: CustomStopInput) => Promise<boolean>;
  onMobileSnapChange: (snap: AddStopMobileSnap) => void;
}

export function AddStopPanel({
  isMobile,
  width,
  destinations,
  filteredDestinations,
  destinationsLoading,
  destinationsError,
  addedDestinationIds,
  hoveredDestinationId,
  mode,
  selectedDay,
  maxDay,
  startTime,
  category,
  adding,
  addError,
  sessionCount,
  pickedPoint,
  mobileSnap,
  mobileHeight,
  mobileBottomInset = 0,
  onClose,
  onRetryDestinations,
  onModeChange,
  onSelectedDayChange,
  onNewDay,
  onStartTimeChange,
  onCategoryChange,
  onSearchChange,
  onHoverDestination,
  onAddDestination,
  onAddCustomStop,
  onMobileSnapChange,
}: AddStopPanelProps) {
  const { options: destinationOptions } = useDestinationOptions();
  const categoryNames = destinationOptions?.categories.map((category) => category.name) ?? [];
  const [searchInput, setSearchInput] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [customCategory, setCustomCategory] = useState<string>("Other");
  const [customTime, setCustomTime] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [customBudget, setCustomBudget] = useState("");

  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // Debounce search so the list and map pins only filter after the user pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => onSearchChange(searchInput.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Let an open dialog handle Escape first instead of closing both layers.
      if (document.querySelector('[role="dialog"]')) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const dayOptions = useMemo(() => {
    const last = Math.max(maxDay, selectedDay, 1);
    return Array.from({ length: last }, (_, index) => index + 1);
  }, [maxDay, selectedDay]);

  const hasFilters = searchInput.trim() !== "" || category !== null;

  const clearFilters = () => {
    setSearchInput("");
    onSearchChange("");
    onCategoryChange(null);
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    const currentHeight = dragHeight ?? drag.startHeight;
    dragRef.current = null;
    setDragHeight(null);

    if (!drag.moved) {
      onMobileSnapChange(mobileSnap === "half" ? "full" : "half");
      return;
    }

    const available = Math.max(window.innerHeight - 64 - mobileBottomInset, 260);
    const half = Math.round(available * 0.56);
    const full = Math.round(available * 0.92);
    onMobileSnapChange(Math.abs(currentHeight - half) < Math.abs(currentHeight - full) ? "half" : "full");
  };

  const handleCustomSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (adding || !pickedPoint || customTitle.trim() === "") return;
    const added = await onAddCustomStop({
      title: customTitle.trim(),
      address: customAddress.trim(),
      category: customCategory,
      startTime: customTime,
      duration: customDuration,
      budget: customBudget,
      latitude: pickedPoint.lat,
      longitude: pickedPoint.lng,
    });
    if (!added) return;
    setCustomTitle("");
    setCustomAddress("");
    setCustomCategory("Other");
    setCustomTime("");
    setCustomDuration("");
    setCustomBudget("");
  };

  const panelStyle = isMobile
    ? { height: `${dragHeight ?? mobileHeight}px`, bottom: `${mobileBottomInset}px` }
    : { width: `${width}px` };

  return (
    <aside
      aria-label="Add stop panel"
      className={cn(
        "pointer-events-auto absolute z-[1050] flex flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-line/60",
        isMobile
          ? "inset-x-0 rounded-t-3xl rounded-b-none add-sheet-enter"
          : "bottom-4 right-4 top-4 rounded-2xl add-panel-enter",
      )}
      style={panelStyle}
    >
      {isMobile ? (
        <button
          type="button"
          aria-label="Resize add stop panel"
          className="flex h-6 w-full shrink-0 touch-none items-center justify-center"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { startY: event.clientY, startHeight: mobileHeight, moved: false };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            const delta = drag.startY - event.clientY;
            if (Math.abs(delta) > 4) drag.moved = true;
            const available = Math.max(window.innerHeight - 64 - mobileBottomInset, 260);
            setDragHeight(Math.max(180, Math.min(available - 8, drag.startHeight + delta)));
          }}
          onPointerUp={finishDrag}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragHeight(null);
          }}
        >
          <span className="h-1 w-10 rounded-full bg-sand-300" aria-hidden="true" />
        </button>
      ) : null}

      <div className="flex shrink-0 items-start gap-3 border-b border-line/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-lagoon-900">Add a stop</h2>
          <p className="mt-0.5 text-xs text-ink-600">
            {mode === "destination" ? "Pick a place, or add a custom pin on the map." : "Click the map to place your custom stop."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close add stop panel"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 md:h-9 md:w-9"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <div className="inline-flex w-full rounded-full bg-sand-100 p-0.5 text-sm font-semibold" role="tablist">
          {(["destination", "custom"] as AddStopMode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => onModeChange(value)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-full px-3 py-1.5 transition-colors md:min-h-0",
                mode === value ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-ink-900",
              )}
            >
              {value === "destination" ? "From destinations" : "Custom stop"}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Add to</span>
          <select
            aria-label="Add to day"
            value={selectedDay}
            onChange={(event) => onSelectedDayChange(Number(event.target.value))}
            className="h-11 min-w-0 flex-1 appearance-none rounded-xl bg-white px-3 text-sm font-semibold text-lagoon-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400 md:h-9"
          >
            {dayOptions.map((day) => (
              <option key={day} value={day}>
                Day {day}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onNewDay}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-sea-600 transition-colors hover:bg-sand-100 md:h-9"
          >
            <PlusIcon className="h-3.5 w-3.5" /> New day
          </button>
        </div>
        {mode === "destination" ? (
          <label className="mt-2 flex items-center gap-2 text-[11px] font-medium text-ink-600">
            <span className="shrink-0">Start time (optional)</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg bg-white/70 px-2 text-xs text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400 md:h-8"
            />
          </label>
        ) : null}
      </div>

      {mode === "destination" ? (
        <>
          <div className="shrink-0 px-4 pt-3">
            <label className="flex min-h-11 items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-surf-400 md:min-h-0">
              <SearchIcon className="h-4 w-4 shrink-0 text-ink-500" />
              <input
                className="w-full min-w-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-600/50 focus:outline-none"
                placeholder="Search destinations…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="shrink-0 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onCategoryChange(null)}
                aria-pressed={category === null}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors md:min-h-0 md:px-2.5 md:text-[11px]",
                  category === null ? "bg-lagoon-900 text-sand-50" : "bg-sand-100 text-ink-600 hover:bg-sand-200",
                )}
              >
                All
              </button>
              {categoryNames.map((entry) => {
                const option = destinationOptions?.categories.find((category) => category.name === entry);
                return (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => onCategoryChange(category === entry ? null : entry)}
                    aria-pressed={category === entry}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors md:min-h-0 md:px-2.5 md:text-[11px]",
                      category === entry ? "bg-lagoon-900 text-sand-50" : "bg-sand-100 text-ink-600 hover:bg-sand-200",
                    )}
                  >
                    {option?.color ? (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: category === entry ? "#f8fafc" : option.color }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {entry}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
            {destinationsLoading ? (
              <ul className="space-y-1" aria-label="Loading destinations">
                {Array.from({ length: 7 }).map((_, index) => (
                  <li key={index} className="flex animate-pulse items-center gap-3 px-2.5 py-2">
                    <span className="h-11 w-11 shrink-0 rounded-xl bg-sand-100" />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="block h-3 w-2/3 rounded-full bg-sand-100" />
                      <span className="block h-2.5 w-1/3 rounded-full bg-sand-100" />
                    </span>
                    <span className="h-3 w-12 rounded-full bg-sand-100" />
                  </li>
                ))}
              </ul>
            ) : destinationsError ? (
              <div className="mx-2 my-3 space-y-3 rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                <p>{destinationsError}</p>
                <Button size="sm" variant="secondary" onClick={onRetryDestinations}>
                  Try again
                </Button>
              </div>
            ) : filteredDestinations.length === 0 ? (
              <div className="mx-2 my-6 rounded-xl border border-dashed border-line px-4 py-8 text-center">
                <p className="text-sm font-semibold text-ink-900">No destinations match.</p>
                <p className="mt-1 text-xs text-ink-600">Try another search or category.</p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 rounded-full px-3 py-1.5 text-xs font-semibold text-sea-600 hover:bg-sand-100"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filteredDestinations.map((destination) => {
                  const added = destination.id !== undefined && addedDestinationIds.has(destination.id);
                  const highlighted = hoveredDestinationId === destination.id;
                  return (
                    <li key={destination.id}>
                      <button
                        type="button"
                        disabled={adding}
                        onClick={() => onAddDestination(destination)}
                        onMouseEnter={() => onHoverDestination(destination.id)}
                        onMouseLeave={() => onHoverDestination(null)}
                        onFocus={() => onHoverDestination(destination.id)}
                        onBlur={() => onHoverDestination(null)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-sand-50 disabled:cursor-progress disabled:opacity-60",
                          highlighted && "bg-sand-50",
                        )}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand-100 text-ink-500 ring-1 ring-inset ring-line/60">
                          {destination.image_url ? (
                            <img src={destination.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <PinIcon className="h-5 w-5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 truncate text-sm font-semibold text-ink-900" title={destination.name}>
                              {destination.name}
                            </span>
                            {added ? (
                              <Badge tone="surf" className="shrink-0 text-[10px]">
                                Added
                              </Badge>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-600">
                            {destination.municipality ?? destination.region}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs font-semibold text-sea-600">{formatMoney(destination.estimated_cost)}</span>
                          <span
                            className={cn(
                              "inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-white",
                              added ? "bg-lagoon-900" : "bg-surf-400",
                            )}
                          >
                            {adding ? "Adding…" : added ? "Add again" : "Add"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleCustomSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ring-1 ring-inset",
              pickedPoint
                ? "bg-surf-400/10 text-sea-600 ring-surf-400/30"
                : "bg-sand-50 text-ink-600 ring-line",
            )}
          >
            <MapIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {pickedPoint
                ? `Pinned at ${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}. Click the map to move it.`
                : "Click the map to drop a pin for this stop."}
            </span>
          </div>

          <Input
            label="Stop name"
            value={customTitle}
            onChange={(event) => setCustomTitle(event.target.value)}
            placeholder="Lunch at Carbon Market"
            maxLength={255}
            required
          />
          <Input
            label="Address (optional)"
            value={customAddress}
            onChange={(event) => setCustomAddress(event.target.value)}
            placeholder="Street, barangay, city"
            maxLength={500}
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className="block text-sm font-semibold text-ink-900">Category</span>
              <select
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl bg-white/70 px-3 text-sm text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400"
              >
                {CUSTOM_STOP_CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Start time"
              type="time"
              value={customTime}
              onChange={(event) => setCustomTime(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Duration (min)"
              type="number"
              min={5}
              max={1440}
              value={customDuration}
              onChange={(event) => setCustomDuration(event.target.value)}
              placeholder="60"
            />
            <Input
              label="Budget (₱)"
              type="number"
              min={0}
              value={customBudget}
              onChange={(event) => setCustomBudget(event.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input label="Latitude" readOnly value={pickedPoint ? pickedPoint.lat.toFixed(6) : ""} placeholder="—" className="bg-sand-50" />
            <Input label="Longitude" readOnly value={pickedPoint ? pickedPoint.lng.toFixed(6) : ""} placeholder="—" className="bg-sand-50" />
          </div>

          {addError ? <InlineError message={addError} /> : null}

          <Button type="submit" className="h-11 w-full" disabled={adding || !pickedPoint || customTitle.trim() === ""}>
            {adding ? "Adding…" : "Add custom stop"}
          </Button>
        </form>
      )}

      {mode === "destination" && addError ? (
        <div className="shrink-0 px-4 pb-2">
          <InlineError message={addError} />
        </div>
      ) : null}

      <div className="shrink-0 border-t border-line/60 bg-white/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-ink-600">
            {sessionCount > 0
              ? `${sessionCount} ${sessionCount === 1 ? "stop" : "stops"} added this session`
              : `${destinations.length} destinations ready to add`}
          </p>
          <Button size="sm" variant="secondary" onClick={onClose} disabled={adding} className="h-11 px-4 md:h-8 md:px-3">
            Done
          </Button>
        </div>
      </div>
    </aside>
  );
}
