/* eslint-disable react-refresh/only-export-components */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import { CrosshairIcon, PlusIcon, RouteIcon, XIcon } from "@/components/icons";
import { destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";
import type { CurrentLocationStatus } from "@/hooks/use-current-location";
import type { Destination, RouteGeometryResponse } from "@/lib/types";

export interface RouteStop {
  id?: number;
  name: string;
  municipality?: string | null;
  lat: number;
  lng: number;
  isOrigin?: boolean;
}

export const CEBU_CITY_COORDS = {
  name: "Cebu City",
  municipality: "Cebu City",
  lat: 10.3157,
  lng: 123.8854,
};

const HIDDEN_STORAGE_KEY = "lakbai.map.route_card_hidden";

export const PRESET_SOUTH_CEBU: RouteStop[] = [
  { name: "Cebu City", municipality: "Cebu City", lat: 10.3157, lng: 123.8854, isOrigin: true },
  { name: "Moalboal", municipality: "Moalboal", lat: 9.95, lng: 123.3833 },
  { name: "Kawasan Falls", municipality: "Badian", lat: 9.8019444, lng: 123.3738889 },
];

export function formatRouteDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function formatRouteDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return "—";
  return formatDistance(meters) ?? "—";
}

function gpsLocationHint(status: CurrentLocationStatus): string | null {
  switch (status) {
    case "active":
      return null;
    case "idle":
      return "Location is off, so this route starts in Cebu City. Turn location on to start from where you are.";
    case "locating":
      return "Looking for your location…";
    case "denied":
      return "Location is blocked. Allow it in the browser site settings, then try again. This route starts in Cebu City until then.";
    case "unavailable":
      return "Location is unavailable on this device. This route starts in Cebu City until it is on.";
    case "timeout":
      return "Finding your location took too long. This route starts in Cebu City until GPS responds.";
    case "insecure":
      return "Location needs HTTPS or localhost. This route starts in Cebu City on this page.";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

interface MapRouteCardProps {
  selectedDestination: Destination | null;
  destinations: Destination[];
  route: RouteGeometryResponse | null;
  routeLoading: boolean;
  routeError: string | null;
  onRetryRoute: () => void;
  originType: "cebu_city" | "my_location" | "custom";
  onChangeOriginType: (type: "cebu_city" | "my_location" | "custom") => void;
  customOrigin: Destination | null;
  onSelectCustomOrigin: (destination: Destination | null) => void;
  stops: RouteStop[];
  onAddStop: (destination: Destination) => void;
  onRemoveStop: (index: number) => void;
  onReorderStops: (fromIndex: number, toIndex: number) => void;
  onHighlightStop?: (index: number | null) => void;
  selectionNotice?: string | null;
  activeTargetIndex: number;
  onSelectTargetIndex: (index: number) => void;
  onLoadPreset: () => void;
  onClearRoute: () => void;
  onAddToTrip?: (destination: Destination) => void;
  gpsStatus: CurrentLocationStatus;
  gpsError: string | null;
  onStartGps: () => void;
  onStopGps: () => void;
  liveRoute: RouteGeometryResponse | null;
  liveRouteLoading: boolean;
  liveRouteError: string | null;
  onRetryLiveRoute: () => void;
  livePosition: { lat: number; lng: number; accuracy: number | null } | null;
  isMobile: boolean;
}

export function MapRouteCard({
  selectedDestination,
  destinations,
  route,
  routeLoading,
  routeError,
  onRetryRoute,
  originType,
  onChangeOriginType,
  customOrigin,
  onSelectCustomOrigin,
  stops,
  onAddStop,
  onRemoveStop,
  onReorderStops,
  onHighlightStop,
  selectionNotice,
  activeTargetIndex,
  onSelectTargetIndex,
  onLoadPreset,
  onClearRoute,
  onAddToTrip,
  gpsStatus,
  gpsError,
  onStartGps,
  onStopGps,
  liveRoute,
  liveRouteLoading,
  liveRouteError,
  onRetryLiveRoute,
  livePosition,
  isMobile,
}: MapRouteCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hideButtonRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const autoShowRef = useRef(false);
  const dragSession = useRef<{ id: number; offsetX: number; offsetY: number; parentLeft: number; parentTop: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(HIDDEN_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [addingStop, setAddingStop] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [originSearch, setOriginSearch] = useState("");

  const selectedId = selectedDestination?.id ?? null;
  const hasActiveRoute = selectedId !== null || stops.length > 1;
  const isMultiStop = stops.length > 2;
  const needsBoat = route?.approximate === true && route.reason === "no_road_route";
  const locationHint = gpsLocationHint(gpsStatus);

  const placeCard = useCallback((x: number, y: number) => {
    const node = cardRef.current;
    const parent = node?.offsetParent instanceof HTMLElement ? node.offsetParent : null;
    if (!node || !parent) {
      setDragPos({ x, y });
      return;
    }
    const width = node.offsetWidth;
    const height = Math.min(node.offsetHeight, parent.clientHeight - 16);
    let nextX = Math.min(Math.max(8, x), Math.max(8, parent.clientWidth - width - 8));
    const nextY = Math.min(Math.max(8, y), Math.max(8, parent.clientHeight - height - 8));
    const reservedLeft = parent.clientWidth - 60;
    const reservedTop = isMobile ? 8 : parent.clientHeight - 60;
    if (nextX + width > reservedLeft && nextY < reservedTop + 52 && nextY + height > reservedTop) {
      nextX = Math.max(8, reservedLeft - width);
    }
    setDragPos({ x: nextX, y: nextY });
  }, [isMobile]);

  const onDragPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element) {
      const control = target.closest("button, a, input, select, textarea, label");
      if (control && control !== event.currentTarget) return;
    }
    const node = cardRef.current;
    const parent = node?.offsetParent instanceof HTMLElement ? node.offsetParent : null;
    if (!node || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    dragSession.current = {
      id: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      parentLeft: parentRect.left,
      parentTop: parentRect.top,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSession.current;
    if (!session || session.id !== event.pointerId) return;
    placeCard(event.clientX - session.parentLeft - session.offsetX, event.clientY - session.parentTop - session.offsetY);
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragSession.current || dragSession.current.id !== event.pointerId) return;
    dragSession.current = null;
    setDragging(false);
  };

  const onDragKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? 32 : 16;
    if (event.key === "Escape" && dragPos) {
      event.preventDefault();
      setDragPos(null);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const node = cardRef.current;
    const parent = node?.offsetParent instanceof HTMLElement ? node.offsetParent : null;
    if (!node || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    placeCard(rect.left - parentRect.left + dx, rect.top - parentRect.top + dy);
  };

  useEffect(() => {
    if (!dragPos) return;
    const onResize = () => placeCard(dragPos.x, dragPos.y);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [dragPos, placeCard]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(HIDDEN_STORAGE_KEY, hidden ? "1" : "0");
    } catch {
      // sessionStorage unavailable
    }
  }, [hidden]);

  // Reveal the card again when the route target changes (new destination or preset).
  useEffect(() => {
    if (!autoShowRef.current) {
      autoShowRef.current = true;
      return;
    }
    if (selectedId !== null || stops.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(false);
    }
  }, [selectedId, stops.length]);

  const hideCard = () => {
    setHidden(true);
    window.setTimeout(() => iconRef.current?.focus(), 0);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    event.stopPropagation();
    hideCard();
  };

  const showIcon = (
    <button
      ref={iconRef}
      type="button"
      onClick={() => {
        setHidden(false);
        window.setTimeout(() => hideButtonRef.current?.focus(), 0);
      }}
      aria-label="Show route card"
      aria-expanded={false}
      title="Show route"
      inert={!hidden}
      aria-hidden={!hidden || undefined}
      style={dragPos ? { left: dragPos.x, top: dragPos.y } : undefined}
      className={cn(
        "pointer-events-auto absolute z-[800] flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#14b8a6]/40 bg-white text-[#14b8a6] shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14b8a6] focus-visible:ring-offset-2 md:h-[52px] md:w-[52px]",
        !dragPos && (isMobile ? "left-3 top-[4.5rem]" : "left-4 top-[4.5rem]"),
        hidden ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0",
      )}
    >
      <RouteIcon className="h-6 w-6 md:h-7 md:w-7" />
      {hasActiveRoute ? (
        <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#14b8a6]" aria-hidden="true" />
      ) : null}
    </button>
  );

  const shellClass = cn(
    "pointer-events-auto z-[800] overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-md origin-top-left transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none",
    dragPos
      ? "absolute max-h-[min(72vh,calc(100%-1rem))] w-[min(21.5rem,calc(100%-1rem))]"
      : isMobile
        ? "absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[min(72vh,calc(100%-5.5rem))]"
        : "absolute left-4 top-[4.5rem] w-[min(21.5rem,calc(100%-2rem))] max-h-[calc(100%-6rem)]",
    hidden ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100",
    dragging && "select-none",
  );
  const shellStyle = dragPos ? { left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto" } : undefined;
  const dragPointerProps = {
    onPointerDown: onDragPointerDown,
    onPointerMove: onDragPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, select, textarea")) return;
      setDragPos(null);
    },
  };
  const dragHandleClass =
    "mx-auto mt-1.5 block h-1.5 w-10 cursor-grab rounded-full bg-sand-300 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 active:cursor-grabbing";
  const dragKeyProps = {
    onKeyDown: onDragKeyDown,
    tabIndex: 0,
    role: "button" as const,
    "aria-label": "Drag route card. Arrow keys move it. Escape puts it back. Double-click the card header to reset.",
    "aria-grabbed": dragging,
    className: dragHandleClass,
  };

  // Autocomplete candidates for adding a stop
  const stopCandidates = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    const existingIds = new Set(stops.map((s) => s.id).filter((id): id is number => id != null));
    return destinations
      .filter((d) => !existingIds.has(d.id))
      .filter((d) => {
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || (d.municipality ?? "").toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [destinations, stops, addSearch]);

  // Autocomplete candidates for custom origin
  const originCandidates = useMemo(() => {
    const q = originSearch.trim().toLowerCase();
    return destinations
      .filter((d) => {
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || (d.municipality ?? "").toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [destinations, originSearch]);

  const activeTargetStop = stops[activeTargetIndex] ?? stops[stops.length - 1];

  // Google Maps directions deep link
  const googleMapsUrl = useMemo(() => {
    if (stops.length < 2) return null;
    const origin = stops[0];
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(1, -1);
    const originParam = `${origin.lat},${origin.lng}`;
    const destParam = `${destination.lat},${destination.lng}`;
    const base = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`;
    if (waypoints.length > 0) {
      const waypointsParam = waypoints.map((w) => `${w.lat},${w.lng}`).join("|");
      return `${base}&waypoints=${encodeURIComponent(waypointsParam)}`;
    }
    return base;
  }, [stops]);

  // Case 1: Nothing selected and no multi-stop trip active
  if (!selectedDestination && stops.length <= 1) {
    return (
      <>
        <div
          ref={cardRef}
          className={shellClass}
          style={shellStyle}
          role="region"
          aria-label="Route planner"
          aria-hidden={hidden || undefined}
          inert={hidden}
          onKeyDown={onCardKeyDown}
        >
          <button
            type="button"
            {...dragKeyProps}
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(dragHandleClass, "cursor-grab touch-none active:cursor-grabbing")}
          />
          <div className="flex items-center justify-between gap-2 px-3.5 pb-1" {...dragPointerProps}>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <RouteIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-lagoon-950">Plan a route</p>
                <p className="text-[11px] text-ink-600">Search or tap a destination to see the route. Drag this card to move it.</p>
              </div>
            </div>
            <button
              ref={hideButtonRef}
              type="button"
              onClick={hideCard}
              aria-label="Hide route card"
              aria-expanded={!hidden}
              title="Hide"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100 hover:text-ink-900 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14b8a6]"
            >
              <ChevronDownIcon className="h-4 w-4 rotate-180" />
            </button>
          </div>

          {selectionNotice ? (
            <p className="mt-2 text-[11px] text-rose-700" role="status">{selectionNotice}</p>
          ) : null}

          <div className="mt-3 border-t border-line/60 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Suggested road trip</p>
            <button
              type="button"
              onClick={() => {
                onLoadPreset();
                setHidden(false);
              }}
              className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-sky-200/80 bg-sky-50/70 p-2 text-left transition-colors hover:bg-sky-100/70"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-sky-950">South Cebu Road Trip</p>
                <p className="truncate text-[10px] text-sky-700">Cebu City → Moalboal → Kawasan Falls</p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">Load</span>
            </button>
          </div>
        </div>
        {showIcon}
      </>
    );
  }

  // Case 2: Destination or Multi-stop Active
  const title = isMultiStop
    ? `Road Trip (${stops.length - 1} stops)`
    : `Route to ${selectedDestination?.name ?? stops[1]?.name ?? "Destination"}`;
  const subtitle = isMultiStop
    ? `${stops[0].name} → ${stops[stops.length - 1].name}`
    : selectedDestination ? destinationLocation(selectedDestination) : stops[1]?.municipality ?? "";

  return (
    <>
      <div
        ref={cardRef}
        className={cn(shellClass, "flex flex-col")}
        style={shellStyle}
        role="region"
        aria-label="Route details"
        aria-hidden={hidden || undefined}
        inert={hidden}
        onKeyDown={onCardKeyDown}
      >
      <button
        type="button"
        {...dragKeyProps}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(dragHandleClass, "cursor-grab touch-none active:cursor-grabbing")}
      />
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line/50 px-3.5 pt-2 pb-2.5" {...dragPointerProps}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                needsBoat
                  ? "bg-amber-100 text-amber-800"
                  : route?.approximate
                    ? "bg-amber-50 text-amber-700"
                    : "bg-sky-100 text-sky-800",
              )}
            >
              {needsBoat ? "Ferry / boat" : route?.approximate ? "Approx." : "Road route"}
            </span>
            {isMultiStop ? (
              <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                {stops.length - 1} stops
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 truncate text-sm font-bold text-lagoon-950" title={title}>
            {title}
          </h2>
          <p className="truncate text-[11px] text-ink-600">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            ref={hideButtonRef}
            type="button"
            onClick={hideCard}
            aria-label="Hide route card"
            aria-expanded={!hidden}
            title="Hide"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100 hover:text-ink-900 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14b8a6]"
          >
            <ChevronDownIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={onClearRoute}
            aria-label="Clear route"
            title="Clear route"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14b8a6]"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded body */}
      <div className="overflow-y-auto p-3.5 space-y-3 flex-1">
          {/* Origin Selector */}
          <div className="rounded-xl border border-line/70 bg-sand-50/60 p-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-700">
              <span>From (Origin)</span>
              {originType === "custom" && customOrigin ? (
                <button
                  type="button"
                  onClick={() => setPickingOrigin(true)}
                  className="text-sea-600 hover:underline"
                >
                  Change
                </button>
              ) : null}
            </div>

            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onChangeOriginType("my_location");
                  onStartGps();
                }}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
                  originType === "my_location"
                    ? "bg-sea-600 text-white shadow-xs"
                    : "bg-white text-ink-700 ring-1 ring-line hover:bg-sand-50",
                )}
              >
                <CrosshairIcon className="h-3 w-3" />
                <span>My location</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeOriginType("cebu_city")}
                className={cn(
                  "rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
                  originType === "cebu_city"
                    ? "bg-sea-600 text-white shadow-xs"
                    : "bg-white text-ink-700 ring-1 ring-line hover:bg-sand-50",
                )}
              >
                Cebu City
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeOriginType("custom");
                  setPickingOrigin(true);
                }}
                className={cn(
                  "rounded-lg py-1.5 text-[11px] font-semibold transition-colors truncate px-1",
                  originType === "custom"
                    ? "bg-sea-600 text-white shadow-xs"
                    : "bg-white text-ink-700 ring-1 ring-line hover:bg-sand-50",
                )}
              >
                {customOrigin ? customOrigin.name : "Search…"}
              </button>
            </div>

            {originType === "my_location" && locationHint ? (
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500" role="status">{locationHint}</p>
            ) : null}

            {pickingOrigin && (
              <div className="mt-2 border-t border-line pt-2">
                <input
                  type="search"
                  value={originSearch}
                  onChange={(e) => setOriginSearch(e.target.value)}
                  placeholder="Type origin destination…"
                  className="h-8 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-ink-900 focus:outline-none focus:ring-1 focus:ring-sea-500"
                  autoFocus
                />
                <div className="mt-1 max-h-36 overflow-y-auto space-y-0.5">
                  {originCandidates.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onSelectCustomOrigin(d);
                        setPickingOrigin(false);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-ink-800 hover:bg-sky-50"
                    >
                      <span className="truncate">{d.name}</span>
                      <span className="shrink-0 text-[10px] text-ink-500">{d.municipality}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Island / Ferry Notice */}
          {needsBoat ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-2.5 text-xs leading-relaxed text-amber-900">
              <span className="font-bold">This place needs a ferry or boat. </span>
              Showing straight-line distance. There is no road time for open water.
            </div>
          ) : null}

          {/* Route Summary (Single Destination) */}
          {!isMultiStop ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line/80 bg-white p-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{needsBoat ? "Straight-line" : "Distance"}</p>
                <p className="mt-0.5 text-sm font-bold text-lagoon-950" aria-live="polite">
                  {routeLoading && !route ? "Calculating…" : formatRouteDistance(route?.distance_m)}
                  {route?.approximate && !needsBoat ? " approx." : ""}
                </p>
              </div>
              <div className="rounded-xl border border-line/80 bg-white p-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Est. time</p>
                <p className="mt-0.5 text-sm font-bold text-lagoon-950" aria-live="polite">
                  {needsBoat ? "—" : routeLoading && !route ? "Calculating…" : formatRouteDuration(route?.duration_s)}
                  {route?.approximate && !needsBoat ? " approx." : ""}
                </p>
              </div>
            </div>
          ) : null}

          {/* Multi-stop Legs & Reordering */}
          {isMultiStop ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink-700">
                <span>Trip Itinerary ({stops.length - 1} stops)</span>
                <span className="text-sky-700 font-bold">
                  {formatRouteDistance(route?.distance_m)} · {formatRouteDuration(route?.duration_s)}
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {stops.slice(1).map((stop, idx) => {
                  const leg = route?.legs[idx];
                  const actualIndex = idx + 1;
                  return (
                    <div
                      key={`${stop.name}-${actualIndex}`}
                      className={cn(
                        "flex w-full items-center justify-between gap-1.5 rounded-xl border p-2 text-left text-xs",
                        activeTargetIndex === actualIndex ? "border-sky-400 bg-sky-50" : "border-line/80 bg-white",
                      )}
                      onMouseEnter={() => onHighlightStop?.(actualIndex)}
                      onMouseLeave={() => onHighlightStop?.(null)}
                      onFocus={() => onHighlightStop?.(actualIndex)}
                      onBlur={() => onHighlightStop?.(null)}
                      onClick={() => onSelectTargetIndex(actualIndex)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectTargetIndex(actualIndex);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={activeTargetIndex === actualIndex}
                      aria-label={`${stop.name}, ${needsBoat ? "straight-line" : "road"} leg`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                          {actualIndex}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-900">{stop.name}</p>
                          <p className="text-[10px] text-ink-500">
                            {needsBoat
                              ? `${formatRouteDistance(leg?.distance_m)} straight-line`
                              : leg
                                ? `${formatRouteDistance(leg.distance_m)} · ${formatRouteDuration(leg.duration_s)}`
                                : routeLoading
                                  ? "Calculating…"
                                  : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          disabled={actualIndex <= 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            onReorderStops(actualIndex, actualIndex - 1);
                          }}
                          aria-label={`Move ${stop.name} up`}
                          className="rounded p-1 text-ink-500 hover:bg-sand-100 disabled:opacity-30"
                        >
                          <ArrowUpIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={actualIndex >= stops.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            onReorderStops(actualIndex, actualIndex + 1);
                          }}
                          aria-label={`Move ${stop.name} down`}
                          className="rounded p-1 text-ink-500 hover:bg-sand-100 disabled:opacity-30"
                        >
                          <ArrowDownIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveStop(actualIndex);
                          }}
                          aria-label={`Remove ${stop.name}`}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Add Stop Button & Picker */}
          {stops.length >= 25 ? (
            <p className="text-[11px] text-ink-500">A route can include at most 25 points.</p>
          ) : !addingStop ? (
            <button
              type="button"
              onClick={() => setAddingStop(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100/60"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Add another stop (road trip)</span>
            </button>
          ) : (
            <div className="rounded-xl border border-sky-300 bg-white p-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-lagoon-900 mb-1.5">
                <span>Add Destination to Trip</span>
                <button
                  type="button"
                  onClick={() => {
                    setAddingStop(false);
                    setAddSearch("");
                  }}
                  className="text-ink-500 hover:text-ink-800"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="search"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search destination to add…"
                className="h-8 w-full rounded-lg border border-line bg-sand-50 px-2.5 text-xs text-ink-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                autoFocus
              />
              <div className="mt-1.5 max-h-36 overflow-y-auto space-y-0.5">
                {stopCandidates.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onAddStop(d);
                      setAddingStop(false);
                      setAddSearch("");
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-ink-800 hover:bg-sky-50"
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="shrink-0 text-[10px] text-ink-500">{d.municipality}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Routing Error Notice with Retry */}
          {routeError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 flex items-center justify-between gap-2">
              <span className="truncate">Error: {routeError}</span>
              <button
                type="button"
                onClick={onRetryRoute}
                className="shrink-0 font-bold underline text-rose-900"
              >
                Retry
              </button>
            </div>
          ) : null}

          {/* Target Navigation & Live GPS section */}
          <div className="border-t border-line/70 pt-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="route-target-select" className="text-[11px] font-semibold text-ink-700">
                Target Stop
              </label>
              {stops.length > 2 ? (
                <select
                  id="route-target-select"
                  value={activeTargetIndex}
                  onChange={(e) => onSelectTargetIndex(Number(e.target.value))}
                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {stops.slice(1).map((s, idx) => (
                    <option key={`${s.name}-${idx}`} value={idx + 1}>
                      Stop {idx + 1}: {s.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {/* GPS Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={gpsStatus === "active" ? onStopGps : onStartGps}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors",
                  gpsStatus === "active"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                    : "bg-sky-700 text-white hover:bg-sky-800 shadow-xs",
                )}
              >
                <CrosshairIcon className={cn("h-4 w-4", gpsStatus === "locating" && "animate-spin")} />
                {gpsStatus === "active"
                  ? "Stop GPS"
                  : gpsStatus === "locating"
                    ? "Locating…"
                    : "Start Live GPS"}
              </button>
            </div>

            {gpsError && originType !== "my_location" ? (
              <p className="text-[11px] leading-tight text-rose-700">{gpsError}</p>
            ) : null}

            {/* Live GPS Remaining Box */}
            {gpsStatus === "active" && livePosition ? (
              <div className="rounded-xl bg-sky-50 p-2.5 ring-1 ring-inset ring-sky-200">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                  Remaining to {activeTargetStop.name.split(",")[0]}
                </p>
                <p className="mt-0.5 text-xs font-bold text-sky-950" aria-live="polite">
                  {liveRoute
                    ? `${formatRouteDistance(liveRoute.distance_m)} · ${liveRoute.reason === "no_road_route" ? "straight-line" : formatRouteDuration(liveRoute.duration_s)}${liveRoute.approximate && liveRoute.reason !== "no_road_route" ? " approx." : ""}`
                    : liveRouteLoading
                      ? "Calculating live route…"
                      : "Calculating live route…"}
                  {liveRoute && liveRouteLoading ? " · updating" : ""}
                </p>
                {liveRouteError ? (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-rose-700">
                    <span>Could not update live route.</span>
                    <button type="button" onClick={onRetryLiveRoute} className="font-bold underline">
                      Retry
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-line/70 pt-2.5 flex flex-wrap items-center gap-1.5">
            {googleMapsUrl ? (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-sand-100 px-2.5 text-[11px] font-semibold text-ink-800 hover:bg-sand-200 transition-colors"
              >
                <span>Google Maps ↗</span>
              </a>
            ) : null}

            {selectedDestination && onAddToTrip ? (
              <button
                type="button"
                onClick={() => onAddToTrip(selectedDestination)}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-surf-400/20 px-2.5 text-[11px] font-semibold text-sea-700 hover:bg-surf-400/30 transition-colors"
              >
                <PlusIcon className="h-3 w-3" />
                <span>Add to trip</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClearRoute}
              className="ml-auto text-[11px] font-semibold text-ink-500 hover:text-ink-800 px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      {showIcon}
    </>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5m-7 7l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14m7-7l-7 7-7-7" />
    </svg>
  );
}
