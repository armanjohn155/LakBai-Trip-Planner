import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import {
  AddStopPanel,
  addStopSheetHeight,
  type AddStopMobileSnap,
  type AddStopMode,
  type CustomStopInput,
} from "@/components/features/itinerary/add-stop-panel";
import { TripArrivalPrompt, TripReviewCard } from "@/components/features/itinerary/arrival-prompt";
import { GroupPartyPanel } from "@/components/features/itinerary/group-party-panel";
import { ShareDialog } from "@/components/features/itinerary/share-dialog";
import { StopEditor } from "@/components/features/itinerary/stop-editor";
import { TemplatesDialog } from "@/components/features/itinerary/templates-dialog";
import { TripFinishDialog, TripSummaryCard } from "@/components/features/itinerary/trip-finish-dialog";
import { TripLiveBar } from "@/components/features/itinerary/trip-live-bar";
import { TripPauseSheet } from "@/components/features/itinerary/trip-pause-sheet";
import { TripStartDialog } from "@/components/features/itinerary/trip-start-dialog";
import { TripMapCanvas } from "@/components/features/itinerary/trip-map-canvas";
import { TripPanel, mobileSheetHeight, type MobileSnap } from "@/components/features/itinerary/trip-panel";
import { dayColor } from "@/components/features/map/map-pin";
import {
  ArrowLeftIcon,
  BellIcon,
  ChevronIcon,
  ClockIcon,
  CrosshairIcon,
  LayersIcon,
  PlusIcon,
  RouteIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/hooks/use-auth";
import { useDraggable } from "@/hooks/use-draggable";
import { useGroupTracking } from "@/hooks/use-group-tracking";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useMediaQuery, useViewportHeight, useViewportWidth } from "@/hooks/use-media-query";
import { useTripTracking, type LivePosition } from "@/hooks/use-trip-tracking";
import { useLiveRoute, usePlannedRoutes } from "@/hooks/use-route";
import { useNavigation } from "@/hooks/use-navigation";
import { useRouteAlerts } from "@/hooks/use-route-alerts";
import { cn } from "@/lib/cn";
import { haversineMeters } from "@/lib/geo";
import {
  addItineraryItem,
  apiConflict,
  apiError,
  arriveAtStop,
  completeStop,
  deleteItineraryItem,
  finishTrip,
  getDestinations,
  getItinerary,
  getItineraryActivities,
  getItineraryChanges,
  getItineraryRouteEstimates,
  getItinerarySummary,
  getTripTracking,
  pauseTrip,
  reorderItineraryItems,
  rescheduleTrip,
  resumeTrip,
  skipStop,
  startTrip,
  undoStop,
  updateItinerary,
  updateItineraryItem,
  type ItineraryItemPayload,
  type ReorderStop,
} from "@/lib/api";
import type {
  Destination,
  GroupTrackingMember,
  Itinerary,
  ItineraryActivity,
  ItineraryItem,
  ItineraryRouteEstimate,
  ItineraryRouteLeg,
  ItinerarySummary,
  RouteProfile,
  TripTrackingSummary,
} from "@/lib/types";

interface ItineraryBuilderProps {
  itineraryId: number;
  initialAddDestinationId?: number | null;
}

interface DayGroup {
  day: number;
  items: ItineraryItem[];
}

function groupByDay(items: ItineraryItem[]): DayGroup[] {
  const sorted = [...items].sort((a, b) => a.day_number - b.day_number || a.order - b.order);
  const groups: DayGroup[] = [];
  for (const item of sorted) {
    const current = groups[groups.length - 1];
    if (current && current.day === item.day_number) current.items.push(item);
    else groups.push({ day: item.day_number, items: [item] });
  }
  return groups;
}

const TRIP_PANEL_KEY = "suroy.tripPanelWidth";
const TRIP_PANEL_MIN = 440;
const TRIP_PANEL_MAX = 720;
const TRIP_PANEL_DEFAULT = 520;
const TRIP_PANEL_TABLET = 420;
const ADD_PANEL_TABLET = 360;

function clampPanelWidth(value: number): number {
  return Math.min(TRIP_PANEL_MAX, Math.max(TRIP_PANEL_MIN, Math.round(value)));
}

function readPanelWidth(): number {
  try {
    const stored = window.localStorage.getItem(TRIP_PANEL_KEY);
    const value = stored === null ? Number.NaN : Number(stored);
    if (Number.isFinite(value)) return clampPanelWidth(value);
  } catch {
    // Storage can be blocked in private mode; fall back to the default width.
  }
  return TRIP_PANEL_DEFAULT;
}

function positionErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission is off. Enable it to verify this stop.";
  }
  if (error.code === error.TIMEOUT) {
    return "Getting your location timed out. Try again in a moment.";
  }
  return "Your location is unavailable right now. Try again in a moment.";
}

const VERIFY_POSITION_MAX_AGE_MS = 30_000;
const UNDO_WINDOW_MS = 10 * 60 * 1_000;

export function ItineraryBuilder({ itineraryId, initialAddDestinationId }: ItineraryBuilderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1200px)");
  const isTablet = !isMobile && !isDesktop;
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  const [bottomNavHeight, setBottomNavHeight] = useState(0);

  useEffect(() => {
    if (!isMobile) {
      setBottomNavHeight(0);
      return;
    }
    const measure = () => {
      const el = document.getElementById("mobile-bottom-nav");
      setBottomNavHeight(el ? Math.ceil(el.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", measure);
    const el = document.getElementById("mobile-bottom-nav");
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(measure) : null;
    if (ro && el) ro.observe(el);
    const mo = el ? new MutationObserver(measure) : null;
    if (mo && el) mo.observe(el, { attributes: true, attributeFilter: ["class", "style", "aria-hidden"] });
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("focusin", measure);
      document.removeEventListener("focusout", measure);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [isMobile]);

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [summary, setSummary] = useState<ItinerarySummary | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [estimates, setEstimates] = useState<ItineraryRouteEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);

  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(initialAddDestinationId != null);
  const [addMode, setAddMode] = useState<AddStopMode>("destination");
  const [addSelectedDay, setAddSelectedDay] = useState(1);
  const [addStartTime, setAddStartTime] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addCategory, setAddCategory] = useState<string | null>(null);
  const [hoveredDestinationId, setHoveredDestinationId] = useState<number | null>(null);
  const [addPickedPoint, setAddPickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSessionCount, setAddSessionCount] = useState(0);
  const [addMobileSnap, setAddMobileSnap] = useState<AddStopMobileSnap>("half");
  const [duplicateDestination, setDuplicateDestination] = useState<Destination | null>(null);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationsError, setDestinationsError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flashItemId, setFlashItemId] = useState<number | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(readPanelWidth);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [remote, setRemote] = useState<{ version: number; updatedBy: string | null; activities: ItineraryActivity[] } | null>(null);
  const [conflict, setConflict] = useState<{ message: string; itinerary: Itinerary } | null>(null);
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const versionRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const autoCollapsedRef = useRef(false);
  const addingRef = useRef(false);
  const initialDayAppliedRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ point: [number, number]; nonce: number } | null>(null);
  const focusNonceRef = useRef(0);
  const [scrollRequest, setScrollRequest] = useState<{ id: number; nonce: number } | null>(null);
  const scrollNonceRef = useRef(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const [mobileSnap, setMobileSnap] = useState<MobileSnap>("half");

  const [tracking, setTracking] = useState<TripTrackingSummary | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [markingItemId, setMarkingItemId] = useState<number | null>(null);
  const [arrivalStopId, setArrivalStopId] = useState<number | null>(null);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [reviewCard, setReviewCard] = useState<{ destinationId: number; name: string } | null>(null);
  const [followMap, setFollowMap] = useState(true);
  const [finished, setFinished] = useState<{ skipped: number } | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  const positionRef = useRef<LivePosition | null>(null);
  const itemsRef = useRef<ItineraryItem[]>([]);
  const arrivalCandidateRef = useRef<{ id: number; since: number } | null>(null);
  const arrivalTimerRef = useRef<number | null>(null);
  const arrivalDismissedRef = useRef<Set<number>>(new Set());
  const arrivedRecordedRef = useRef<Set<number>>(new Set());

  const bottomNavInset = isMobile ? bottomNavHeight : 0;
  const effectivePanelWidth = isDesktop ? panelWidth : TRIP_PANEL_TABLET;
  const addPanelWidth = isMobile
    ? viewportWidth
    : isTablet
      ? ADD_PANEL_TABLET
      : Math.round(Math.min(420, Math.max(360, viewportWidth * 0.32)));
  const addMobileHeight = addStopSheetHeight(addMobileSnap, Math.max(320, viewportHeight - bottomNavInset));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? { delay: 160, tolerance: 8 } : { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = useCallback(async () => {
    const [trip, bud, routes] = await Promise.all([
      getItinerary(itineraryId),
      getItinerarySummary(itineraryId),
      getItineraryRouteEstimates(itineraryId).catch(() => null),
    ]);
    setItinerary(trip);
    setSummary(bud);
    setEstimates(routes);

    // When opened from a destination card, default the add panel to the trip's last day.
    if (initialAddDestinationId != null && !initialDayAppliedRef.current) {
      initialDayAppliedRef.current = true;
      const lastDay = Math.max(
        bud.day_count || 1,
        ...(trip.items ?? []).map((item) => item.day_number),
        1,
      );
      setAddSelectedDay(lastDay);
    }
  }, [itineraryId, initialAddDestinationId]);

  const refreshStats = useCallback(async () => {
    const [bud, routes] = await Promise.all([
      getItinerarySummary(itineraryId),
      getItineraryRouteEstimates(itineraryId).catch(() => null),
    ]);
    setSummary(bud);
    setEstimates(routes);
  }, [itineraryId]);

  const loadDestinations = useCallback(async () => {
    setDestinationsLoading(true);
    setDestinationsError(null);
    try {
      const dests = await getDestinations({ per_page: 100 });
      setDestinations(dests.data);
    } catch (error) {
      setDestinationsError(apiError(error));
    } finally {
      setDestinationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Data is fetched on mount; all state updates happen in promise callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch((error) => {
        if (!cancelled) setLoadError(apiError(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void loadDestinations();
    return () => {
      cancelled = true;
    };
  }, [refresh, loadDestinations]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    refresh()
      .catch((error) => setLoadError(apiError(error)))
      .finally(() => setLoading(false));
    void loadDestinations();
  }, [refresh, loadDestinations]);

  useEffect(() => {
    if (itinerary) {
      versionRef.current = itinerary.version ?? 0;
      if (remote && remote.version <= versionRef.current) setRemote(null);
    }
  }, [itinerary, remote]);

  useEffect(() => {
    if (!itinerary || itinerary.trip_type !== "group") return;

    let cancelled = false;
    const check = async () => {
      try {
        const changes = await getItineraryChanges(itineraryId, versionRef.current);
        if (cancelled || !changes.data.changed) return;
        setRemote({
          version: changes.data.version,
          updatedBy: changes.data.updated_by,
          activities: changes.data.activities,
        });
      } catch {
        // Polling is best-effort; the next tick will retry.
      }
    };

    const timer = window.setInterval(() => void check(), 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [itinerary, itineraryId]);

  useEffect(() => {
    if (!activityOpen) return;

    let cancelled = false;
    // Loading flag is set when the activity modal opens; the request follows immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivityLoading(true);
    getItineraryActivities(itineraryId)
      .then((page) => {
        if (!cancelled) setActivities(page.data);
      })
      .catch((error) => {
        if (!cancelled) setItemError(apiError(error));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activityOpen, itineraryId]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const items = useMemo(() => itinerary?.items ?? [], [itinerary]);
  const groups = useMemo(() => groupByDay(items), [items]);
  const canEdit = itinerary !== null && itinerary.my_role !== "viewer";
  const isOwner = itinerary?.my_role === "owner";
  const isGroup = itinerary?.trip_type === "group";
  const lifecycle = itinerary?.lifecycle_status ?? "planned";
  const isOngoing = lifecycle === "active" || lifecycle === "paused";

  const groupTracking = useGroupTracking({
    itineraryId,
    enabled: isGroup,
    active: isGroup && lifecycle === "active",
    onMemberArrived: (name, stopTitle) => showToast(`${name} arrived at ${stopTitle}.`),
  });

  const groupSharing = isGroup && groupTracking.sharing;
  const trackingEnabled =
    lifecycle === "active" &&
    (isGroup
      ? groupSharing
      : canEdit && (itinerary?.started_by == null || itinerary.started_by === user?.id));

  const partyMembers = useMemo(
    () =>
      (groupTracking.state?.members ?? []).filter(
        (member) => !member.is_me && member.position !== null,
      ),
    [groupTracking.state],
  );

  const liveTracking = useTripTracking({
    itineraryId,
    enabled: trackingEnabled,
    onUploaded: (result) => {
      setTracking((current) => (current === null ? current : { ...current, distance_m: result.distance_m }));
    },
  });
  const currentLocation = useCurrentLocation();
  const stopCurrentLocation = currentLocation.stop;

  useEffect(() => {
    if (lifecycle !== "planned") stopCurrentLocation();
  }, [lifecycle, stopCurrentLocation]);

  const positionForMap = lifecycle === "planned"
    ? currentLocation.position
    : isOngoing
      ? liveTracking.position ?? currentLocation.position
      : null;
  const livePosition = positionForMap
    ? {
        lat: positionForMap.lat,
        lng: positionForMap.lng,
        accuracy: positionForMap.accuracy,
        heading: positionForMap.heading,
        speed: positionForMap.speed,
      }
    : null;
  const nextStopItem = useMemo(() => {
    const backendNextId = tracking?.next_stop?.id;
    const backendNext = backendNextId == null ? null : items.find((item) => item.id === backendNextId);
    // Navigation advances as soon as GPS records arrival; visit completion
    // remains a separate confirmation in the arrival prompt.
    if (backendNext?.status === "planned") return backendNext;
    return [...items]
      .filter((item) => item.status === "planned")
      .sort((a, b) => a.day_number - b.day_number || a.order - b.order)[0] ?? null;
  }, [items, tracking]);

  const [routeProfile, setRouteProfile] = useState<RouteProfile>("driving");
  const [forceRerouteNonce, setForceRerouteNonce] = useState(0);
  const triggerReroute = useCallback(() => setForceRerouteNonce((n) => n + 1), []);

  const roadRoutes = usePlannedRoutes(items, true, routeProfile);
  const liveRoute = useLiveRoute(
    livePosition ? { lat: livePosition.lat, lng: livePosition.lng } : null,
    nextStopItem?.latitude != null && nextStopItem.longitude != null
      ? { lat: Number(nextStopItem.latitude), lng: Number(nextStopItem.longitude) }
      : null,
    lifecycle === "active" && livePosition !== null && nextStopItem !== null,
    {
      profile: routeProfile,
      forceRerouteNonce,
    },
  );

  const navigation = useNavigation({
    livePosition,
    route: liveRoute.route,
    enabled: lifecycle === "active" && livePosition !== null && nextStopItem !== null,
    profile: routeProfile,
    onOffRoute: triggerReroute,
  });

  const alerts = useRouteAlerts({
    itineraryId,
    activeStop: nextStopItem,
    remainingDistanceM: navigation.remainingDistanceM,
    remainingDurationS: navigation.remainingDurationS,
    enabled: lifecycle === "active",
  });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    positionRef.current = liveTracking.position;
  }, [liveTracking.position]);

  useEffect(() => {
    return () => {
      if (arrivalTimerRef.current !== null) window.clearTimeout(arrivalTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOngoing) return;

    let cancelled = false;
    const load = () => {
      getTripTracking(itineraryId)
        .then((next) => {
          if (!cancelled) setTracking(next);
        })
        .catch(() => {
          // The live bar keeps its last known values; the next poll retries.
        });
    };

    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOngoing, itineraryId]);

  // A stop counts as "arrived" only after the traveller stays inside its
  // radius for 15 continuous seconds. The server still verifies completion.
  useEffect(() => {
    const clearCandidate = () => {
      arrivalCandidateRef.current = null;
      if (arrivalTimerRef.current !== null) {
        window.clearTimeout(arrivalTimerRef.current);
        arrivalTimerRef.current = null;
      }
    };

    const position = liveTracking.position;
    if (!trackingEnabled || position === null) {
      clearCandidate();
      return;
    }

    let closest: { id: number; distance: number } | null = null;
    for (const item of items) {
      if (item.status !== "planned" && item.status !== "arrived") continue;
      const distance = haversineMeters(
        { latitude: position.lat, longitude: position.lng },
        { latitude: item.latitude, longitude: item.longitude },
      );
      if (distance === null) continue;
      const radius = item.destination?.radius_m ?? 150;
      if (distance <= radius && (closest === null || distance < closest.distance)) {
        closest = { id: item.id, distance };
      }
    }

    if (closest === null || arrivalStopId !== null || arrivalDismissedRef.current.has(closest.id)) {
      clearCandidate();
      return;
    }

    if (arrivalCandidateRef.current?.id !== closest.id) {
      clearCandidate();
      const id = closest.id;
      arrivalCandidateRef.current = { id, since: Date.now() };
      arrivalTimerRef.current = window.setTimeout(() => {
        if (arrivalCandidateRef.current?.id !== id) return;
        arrivalTimerRef.current = null;
        setArrivalError(null);
        setArrivalStopId(id);
      }, 15_000);
    }
  }, [trackingEnabled, liveTracking.position, items, arrivalStopId]);

  const travelByLeg = useMemo(() => {
    const map = new Map<string, ItineraryRouteLeg>();
    for (const day of estimates?.days ?? []) {
      for (const leg of day.legs) {
        map.set(`${leg.from_stop_id}-${leg.to_stop_id}`, leg);
      }
    }
    return map;
  }, [estimates]);

  const daySummaryByDay = useMemo(
    () => new Map((summary?.days ?? []).map((day) => [day.day_number, day])),
    [summary],
  );

  const totalDistanceM = useMemo(() => {
    if (estimates?.enabled) {
      const distances = estimates.days
        .flatMap((day) => day.legs)
        .map((leg) => leg.distance_m)
        .filter((distance): distance is number => distance !== null);
      if (distances.length > 0) return distances.reduce((total, distance) => total + distance, 0);
    }

    let total = 0;
    let measured = false;
    for (const group of groups) {
      for (let index = 0; index < group.items.length - 1; index += 1) {
        const distance = haversineMeters(group.items[index], group.items[index + 1]);
        if (distance !== null) {
          total += distance;
          measured = true;
        }
      }
    }
    return measured ? total : null;
  }, [estimates, groups]);

  const mobileHeight = mobileSheetHeight(mobileSnap, viewportHeight, bottomNavInset);
  const maxDay = useMemo(
    () => Math.max(summary?.day_count || 1, ...groups.map((group) => group.day), 1),
    [summary, groups],
  );

  const filteredDestinations = useMemo(() => {
    const term = addSearch.trim().toLowerCase();
    return destinations.filter((destination) => {
      if (addCategory !== null && destination.category !== addCategory) return false;
      if (term === "") return true;
      return [destination.name, destination.municipality, destination.region, destination.category]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [destinations, addSearch, addCategory]);

  const addedDestinationIds = useMemo(
    () => new Set(items.map((item) => item.destination_id).filter((id): id is number => id !== null)),
    [items],
  );

  const bottomSheetHeight = isMobile && addOpen ? Math.max(mobileHeight, addMobileHeight) : mobileHeight;
  const leftMapInset = isMobile ? 16 : panelHidden || panelCollapsed ? 16 : effectivePanelWidth + 40;
  const rightMapInset = isMobile ? 16 : addOpen ? addPanelWidth + 40 : 24;

  const bottomChrome = bottomSheetHeight + bottomNavInset;
  const mapInsets = useMemo(() => {
    if (isMobile) {
      return { top: 92, right: 16, bottom: bottomChrome + 20, left: 16 };
    }
    return { top: 96, right: rightMapInset, bottom: 32, left: leftMapInset };
  }, [isMobile, bottomChrome, rightMapInset, leftMapInset]);

  const visibleMapWidth = viewportWidth - (isMobile ? 32 : leftMapInset + rightMapInset);
  const showLegend = !isMobile && groups.length > 0 && visibleMapWidth > 360;
  const legendOffset = (leftMapInset - rightMapInset) / 2;
  const zoomRightInset = !isMobile && addOpen ? addPanelWidth + 32 : 0;

  const focusItem = useCallback((item: ItineraryItem) => {
    if (item.latitude === null || item.longitude === null) return;
    focusNonceRef.current += 1;
    setFocus({ point: [Number(item.latitude), Number(item.longitude)], nonce: focusNonceRef.current });
  }, []);

  const focusMember = useCallback(
    (member: GroupTrackingMember) => {
      if (member.position === null) return;
      focusNonceRef.current += 1;
      setFocus({ point: [member.position.lat, member.position.lng], nonce: focusNonceRef.current });
      if (isMobile) {
        setMobileSnap("half");
      } else {
        setPanelHidden(false);
        setPanelCollapsed(false);
      }
      showToast(`Centered on ${member.name}.`);
    },
    [isMobile, showToast],
  );

  const focusMeetup = useCallback(() => {
    const meetup = groupTracking.state?.meetup;
    if (!meetup) return;
    focusNonceRef.current += 1;
    setFocus({ point: [meetup.lat, meetup.lng], nonce: focusNonceRef.current });
    if (isMobile) {
      setMobileSnap("half");
    } else {
      setPanelHidden(false);
      setPanelCollapsed(false);
    }
  }, [groupTracking.state?.meetup, isMobile]);

  const handlePinMeetup = useCallback(
    async (note: string) => {
      const position = liveTracking.position;
      if (!position) {
        showToast("Wait for your first GPS fix before dropping a pin.");
        return false;
      }

      const meetup = await groupTracking.pinMeetup(position.lat, position.lng, note);
      if (meetup !== null) showToast("Meeting pin dropped for the next 2 hours.");
      return meetup !== null;
    },
    [groupTracking, liveTracking.position, showToast],
  );

  const selectItem = useCallback(
    (item: ItineraryItem) => {
      setSelectedItemId(item.id);
      focusItem(item);
      if (isMobile) {
        setMobileSnap("half");
      } else {
        setPanelHidden(false);
        setPanelCollapsed(false);
      }
      scrollNonceRef.current += 1;
      setScrollRequest({ id: item.id, nonce: scrollNonceRef.current });
    },
    [focusItem, isMobile],
  );

  const applyItinerary = useCallback((next: Itinerary) => {
    setItinerary(next);
  }, []);

  const handleToggleStatus = async (item: ItineraryItem) => {
    setItemError(null);
    setBusyItem(item.id);
    try {
      applyItinerary(
        await updateItineraryItem(itineraryId, item.id, {
          status: item.status === "done" ? "planned" : "done",
          base_version: itinerary?.version,
        }),
      );
      const bud = await getItinerarySummary(itineraryId);
      setSummary(bud);
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    } finally {
      setBusyItem(null);
    }
  };

  const handleDeleteItem = async (item: ItineraryItem) => {
    setItemError(null);
    setBusyItem(item.id);
    try {
      await deleteItineraryItem(itineraryId, item.id, itinerary?.version);
      await refresh();
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    } finally {
      setBusyItem(null);
    }
  };

  const handleReorder = async (nextGroups: DayGroup[]) => {
    const ordered: ItineraryItem[] = nextGroups.flatMap((group) => group.items.map((item) => ({ ...item, day_number: group.day })));

    const stops: ReorderStop[] = [];
    let position = 1;
    let currentDay = ordered[0]?.day_number ?? 1;
    for (const item of ordered) {
      if (item.day_number !== currentDay) {
        currentDay = item.day_number;
        position = 1;
      }
      stops.push({ id: item.id, day_number: item.day_number, order: position });
      position += 1;
    }

    // Optimistic update, then persist; roll back on failure.
    const previous = itinerary;
    if (itinerary) applyItinerary({ ...itinerary, items: ordered });

    try {
      applyItinerary(await reorderItineraryItems(itineraryId, stops, itinerary?.version));
    } catch (error) {
      if (previous) applyItinerary(previous);
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    }
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(Number(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItemId = Number(active.id);
    const overId = String(over.id);

    const sourceGroup = groups.find((group) => group.items.some((item) => item.id === activeItemId));
    if (!sourceGroup) return;

    // Determine the destination day: either a day container ("day-3") or another stop.
    let targetDay: number;
    let targetIndex: number;

    if (overId.startsWith("day-")) {
      targetDay = Number(overId.replace("day-", ""));
      const targetGroup = groups.find((group) => group.day === targetDay);
      targetIndex = targetGroup ? targetGroup.items.length : 0;
    } else {
      const overItem = items.find((item) => item.id === Number(overId));
      if (!overItem) return;
      targetDay = overItem.day_number;
      const targetGroup = groups.find((group) => group.day === targetDay);
      targetIndex = targetGroup ? targetGroup.items.findIndex((item) => item.id === overItem.id) : 0;
    }

    const nextGroups = groups.map((group) => ({ day: group.day, items: [...group.items] }));
    const from = nextGroups.find((group) => group.day === sourceGroup.day);
    if (!from) return;

    const fromIndex = from.items.findIndex((item) => item.id === activeItemId);
    if (fromIndex < 0) return;

    const [moved] = from.items.splice(fromIndex, 1);

    const toGroup = nextGroups.find((group) => group.day === targetDay) ?? { day: targetDay, items: [] };
    if (!nextGroups.some((group) => group.day === targetDay)) nextGroups.push(toGroup);

    const insertAt = Math.max(0, Math.min(targetIndex, toGroup.items.length));
    toGroup.items.splice(insertAt, 0, { ...moved, day_number: targetDay });

    nextGroups.sort((a, b) => a.day - b.day);
    void handleReorder(nextGroups);
  };

  const handleSaveSettings = async (payload: SettingsPayload) => {
    applyItinerary(await updateItinerary(itineraryId, { ...payload, base_version: itinerary?.version }));
    const bud = await getItinerarySummary(itineraryId);
    setSummary(bud);
  };

  const handleLoadLatest = async () => {
    setConflict(null);
    setRemote(null);
    await refresh().catch((error) => setItemError(apiError(error)));
  };

  const handleCloseAdd = () => {
    setAddOpen(false);
    setAddPickedPoint(null);
    setAddError(null);
    setHoveredDestinationId(null);
    if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false;
      setPanelCollapsed(false);
    }
  };

  const handleOpenAdd = () => {
    if (isOngoing) {
      showToast("Pause or finish the trip before adding stops.");
      return;
    }
    if (addOpen) {
      handleCloseAdd();
      return;
    }
    setAddMode("destination");
    setAddPickedPoint(null);
    setAddError(null);
    setHoveredDestinationId(null);
    setAddSearch("");
    setAddCategory(null);
    setAddStartTime("");
    setAddSelectedDay(maxDay);
    setAddOpen(true);
    if (isMobile) setAddMobileSnap("half");
    if (
      isTablet &&
      !panelHidden &&
      !panelCollapsed &&
      effectivePanelWidth + addPanelWidth > viewportWidth * 0.7
    ) {
      autoCollapsedRef.current = true;
      setPanelCollapsed(true);
    }
  };

  const handleAddModeChange = (mode: AddStopMode) => {
    setAddMode(mode);
    setAddPickedPoint(null);
    setHoveredDestinationId(null);
  };

  const handlePickedPointChange = (point: { lat: number; lng: number } | null) => {
    setAddPickedPoint(point);
  };

  const handleNewDay = () => {
    setAddSelectedDay((current) => Math.max(current, maxDay) + 1);
  };

  const handlePanelResize = (width: number) => {
    const next = clampPanelWidth(width);
    setPanelWidth(next);
    try {
      window.localStorage.setItem(TRIP_PANEL_KEY, String(next));
    } catch {
      // Storage can be unavailable; the width still applies for this session.
    }
  };

  const resolveVerificationPosition = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  }> => {
    const current = positionRef.current;
    const age = current ? Date.now() - new Date(current.recordedAt).getTime() : Number.POSITIVE_INFINITY;
    if (current && age <= VERIFY_POSITION_MAX_AGE_MS) {
      return {
        latitude: current.lat,
        longitude: current.lng,
        accuracy: Math.max(0, current.accuracy ?? 0),
      };
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("This browser can't read your location, so this stop can't be verified.");
    }

    return await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (fix) =>
          resolve({
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
            accuracy: Math.max(0, fix.coords.accuracy),
          }),
        (geoError) => reject(new Error(positionErrorMessage(geoError))),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
    });
  }, []);

  const handleStartTrip = async () => {
    if (!itinerary || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    try {
      const ageMs = currentLocation.position ? Date.now() - Date.parse(currentLocation.position.recordedAt) : Infinity;
      const fix = ageMs <= 30_000 ? currentLocation.position : await currentLocation.requestOnce();
      if (!fix) {
        setLifecycleBusy(false);
        return;
      }
      setFollowMap(true);
      const result = await startTrip(itineraryId, itinerary.version);
      applyItinerary(result.itinerary);
      setTracking(result.tracking);
      setStartOpen(false);
      if (addOpen) handleCloseAdd();
      if (isGroup) void groupTracking.refresh();
      showToast("Trip started. Live tracking is on.");
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setStartOpen(false);
        setConflict(stale);
      } else {
        setLifecycleError(apiError(error));
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleStartWithoutLocation = async () => {
    if (!itinerary || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    try {
      const result = await startTrip(itineraryId, itinerary.version);
      applyItinerary(result.itinerary);
      setTracking(result.tracking);
      setStartOpen(false);
      if (addOpen) handleCloseAdd();
      if (isGroup) void groupTracking.refresh();
      showToast("Trip started without location. You can try My location any time.");
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setStartOpen(false);
        setConflict(stale);
      } else {
        setLifecycleError(apiError(error));
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleMyLocation = () => {
    if (lifecycle === "active" && trackingEnabled && liveTracking.permission === "denied") {
      liveTracking.retryLocation();
      showToast("Retrying location access. Check this site's browser permission if it stays off.");
      return;
    }
    if (!livePosition) {
      if (lifecycle === "planned") currentLocation.start();
      else showToast("Waiting for the trip GPS fix. Check location permissions and retry.");
      return;
    }
    setFollowMap((following) => !following);
    focusNonceRef.current += 1;
    setFocus({ point: [livePosition.lat, livePosition.lng], nonce: focusNonceRef.current });
  };

  const defaultFollowingPosition = useCallback(
    (container: DOMRect, element: DOMRect) => {
      if (isMobile) {
        const x = Math.max(16, container.width - element.width - 16);
        const y = Math.max(16, container.height - (bottomChrome + 84) - element.height);
        return { x, y };
      }
      const x = Math.max(16, container.width - Math.max(16, rightMapInset + 10) - element.width);
      const y = Math.max(16, container.height - 20 - element.height);
      return { x, y };
    },
    [isMobile, bottomChrome, rightMapInset],
  );

  const {
    ref: followingButtonRef,
    position: followingButtonPos,
    isDragging: isFollowingDragging,
    bind: followingButtonBind,
  } = useDraggable<HTMLButtonElement>({
    containerRef: mapContainerRef,
    storageKey: "lakbai_following_btn_pos",
    defaultPosition: defaultFollowingPosition,
    onTap: handleMyLocation,
  });

  const handlePauseTrip = async () => {
    if (!itinerary || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    try {
      const result = await pauseTrip(itineraryId, itinerary.version);
      applyItinerary(result.itinerary);
      setTracking(result.tracking);
      setArrivalStopId(null);
      setArrivalError(null);
      setPauseOpen(true);
      if (isGroup) void groupTracking.refresh();
      showToast("Trip paused. Location sharing stopped.");
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleResumeTrip = async () => {
    if (!itinerary || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    try {
      const result = await resumeTrip(itineraryId, itinerary.version);
      applyItinerary(result.itinerary);
      setTracking(result.tracking);
      setPauseOpen(false);
      if (isGroup) void groupTracking.refresh();
      showToast("Trip resumed. Live tracking is on.");
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setPauseOpen(false);
        setConflict(stale);
      } else {
        setLifecycleError(apiError(error));
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleOpenFinish = () => {
    setLifecycleError(null);
    setFinishOpen(true);
  };

  const handleFinishTrip = async () => {
    if (!itinerary || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    try {
      const result = await finishTrip(itineraryId, itinerary.version);
      applyItinerary(result.itinerary);
      setTracking(result.tracking);
      setFinishOpen(false);
      setPauseOpen(false);
      setArrivalStopId(null);
      setArrivalError(null);
      setReviewCard(null);
      const skipped = (result.itinerary.items ?? []).filter((item) => item.status === "skipped").length;
      setFinished({ skipped });
      setSummaryDismissed(false);
      if (isGroup) void groupTracking.refresh();
      showToast("Trip finished. Opening your recap...");
      navigate(`/app/trips/${itineraryId}/recap`);
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setFinishOpen(false);
        setConflict(stale);
      } else {
        setLifecycleError(apiError(error));
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleReschedule = async (payload: { strategy: "shift"; minutes: number } | { strategy: "move_day"; day_number: number }) => {
    if (!itinerary || lifecycleBusy) return;
    setLifecycleBusy(true);
    setLifecycleError(null);
    try {
      const result = await rescheduleTrip(itineraryId, payload, itinerary.version);
      applyItinerary(result.itinerary);
      setTracking(result.tracking);
      setPauseOpen(false);
      showToast("Remaining stops rescheduled.");
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setPauseOpen(false);
        setConflict(stale);
      } else {
        setLifecycleError(apiError(error));
      }
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleMarkVisited = async (item: ItineraryItem) => {
    if (!itinerary || markingItemId !== null) return;
    setMarkingItemId(item.id);
    setItemError(null);
    setArrivalError(null);
    try {
      const position = await resolveVerificationPosition();
      const result = await completeStop(itineraryId, item.id, position, itinerary.version);
      applyItinerary(result.data);
      setTracking(result.tracking);
      setArrivalStopId(null);
      arrivalDismissedRef.current.delete(item.id);
      const destinationId = result.visit?.destination_id ?? item.destination?.id ?? null;
      if (result.can_review !== false && destinationId !== null) {
        setReviewCard({
          destinationId,
          name: item.destination?.name ?? item.title,
        });
      }
      showToast(`${item.title} marked visited.`);
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setArrivalStopId(null);
        setConflict(stale);
      } else {
        const message = apiError(error);
        if (arrivalStopId === item.id) setArrivalError(message);
        else setItemError(message);
      }
    } finally {
      setMarkingItemId(null);
    }
  };

  const handleSkipStop = async (item: ItineraryItem) => {
    if (!itinerary || markingItemId !== null) return;
    setMarkingItemId(item.id);
    setItemError(null);
    setArrivalError(null);
    try {
      const result = await skipStop(itineraryId, item.id, itinerary.version);
      applyItinerary(result.data);
      setTracking(result.tracking);
      setArrivalStopId(null);
      arrivalDismissedRef.current.delete(item.id);
      showToast(`${item.title} skipped.`);
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) {
        setArrivalStopId(null);
        setConflict(stale);
      } else {
        const message = apiError(error);
        if (arrivalStopId === item.id) setArrivalError(message);
        else setItemError(message);
      }
    } finally {
      setMarkingItemId(null);
    }
  };

  const handleUndoStop = async (item: ItineraryItem) => {
    if (!itinerary || markingItemId !== null) return;
    setMarkingItemId(item.id);
    setItemError(null);
    try {
      const result = await undoStop(itineraryId, item.id, itinerary.version);
      applyItinerary(result.data);
      setTracking(result.tracking);
      showToast(`${item.title} restored.`);
    } catch (error) {
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setItemError(apiError(error));
    } finally {
      setMarkingItemId(null);
    }
  };

  const canUndoStop = (item: ItineraryItem): boolean => {
    if (lifecycle !== "active" && lifecycle !== "paused") return false;
    if (item.status !== "done" && item.status !== "skipped") return false;
    if (!item.completed_at) return false;
    return Date.now() - new Date(item.completed_at).getTime() <= UNDO_WINDOW_MS;
  };

  const handleArrivalNotYet = (item: ItineraryItem) => {
    arrivalDismissedRef.current.add(item.id);
    setArrivalStopId(null);
    setArrivalError(null);
  };

  // Record "arrived" once per stop when the arrival prompt appears. The server
  // still verifies completion, so this is only an honest in-between state.
  useEffect(() => {
    if (arrivalStopId === null || itinerary === null) return;
    if (arrivedRecordedRef.current.has(arrivalStopId)) return;

    const item = (itinerary.items ?? []).find((entry) => entry.id === arrivalStopId);
    if (!item) return;

    arrivedRecordedRef.current.add(arrivalStopId);
    if (item.status !== "planned") return;

    let cancelled = false;
    arriveAtStop(itineraryId, arrivalStopId, itinerary.version)
      .then((result) => {
        if (cancelled) return;
        applyItinerary(result.data);
        setTracking(result.tracking);
      })
      .catch(() => {
        // Arrival is a hint; the completion action verifies proximity again.
      });

    return () => {
      cancelled = true;
    };
  }, [arrivalStopId, itinerary, itineraryId, applyItinerary]);

  useEffect(() => {
    if (lifecycle === "active") return;
    // The prompt is only rendered while active; finished/paused handlers clear it too.
    arrivalCandidateRef.current = null;
    arrivalDismissedRef.current.clear();
  }, [lifecycle]);

  const nextOrderForDay = (day: number): number => {
    const dayItems = (itinerary?.items ?? []).filter((item) => item.day_number === day);
    return dayItems.length === 0 ? 0 : Math.max(...dayItems.map((item) => item.order)) + 1;
  };

  const performAdd = async (
    payload: ItineraryItemPayload,
    optimistic: ItineraryItem,
    successMessage: string,
  ): Promise<boolean> => {
    if (addingRef.current || !itinerary) return false;
    addingRef.current = true;
    setAdding(true);
    setAddError(null);
    setItemError(null);

    const previous = itinerary;
    applyItinerary({ ...previous, items: [...(previous.items ?? []), optimistic] });

    try {
      const next = await addItineraryItem(itineraryId, { ...payload, base_version: previous.version });
      applyItinerary(next);

      const added = (next.items ?? []).reduce<ItineraryItem | null>(
        (newest, item) => (newest === null || item.id > newest.id ? item : newest),
        null,
      );

      if (added) {
        setSelectedItemId(added.id);
        setFlashItemId(added.id);
        if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => setFlashItemId(null), 1800);
        scrollNonceRef.current += 1;
        setScrollRequest({ id: added.id, nonce: scrollNonceRef.current });
      }

      setAddSessionCount((count) => count + 1);
      setAddStartTime("");
      if (payload.destination_id === null) setAddPickedPoint(null);
      showToast(successMessage);
      void refreshStats().catch(() => {
        // Stats are best-effort; the stop itself is already saved.
      });
      return true;
    } catch (error) {
      applyItinerary(previous);
      const stale = apiConflict(error);
      if (stale) setConflict(stale);
      else setAddError(apiError(error));
      return false;
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const addDestinationStop = (destination: Destination, skipDuplicateCheck = false) => {
    if (!canEdit) return;
    if (!skipDuplicateCheck && addedDestinationIds.has(destination.id)) {
      setDuplicateDestination(destination);
      return;
    }

    const day = addSelectedDay;
    const order = nextOrderForDay(day);
    const startTime = addStartTime === "" ? null : addStartTime;
    const optimistic: ItineraryItem = {
      id: -Date.now(),
      itinerary_id: itineraryId,
      destination_id: destination.id,
      custom_title: null,
      custom_latitude: null,
      custom_longitude: null,
      custom_address: null,
      is_custom: false,
      title: destination.name,
      category: destination.category,
      latitude: Number(destination.latitude),
      longitude: Number(destination.longitude),
      day_number: day,
      order,
      start_time: startTime,
      duration_minutes: null,
      estimated_budget: destination.estimated_cost,
      notes: null,
      visited: false,
      status: "planned",
      unavailable: false,
      verified: true,
      destination,
    };

    void performAdd(
      {
        destination_id: destination.id,
        day_number: day,
        order,
        start_time: startTime,
        duration_minutes: null,
      },
      optimistic,
      `Added ${destination.name} to Day ${day}`,
    );
  };

  const confirmAddAgain = () => {
    const destination = duplicateDestination;
    setDuplicateDestination(null);
    if (destination) addDestinationStop(destination, true);
  };

  const addCustomStop = async (input: CustomStopInput): Promise<boolean> => {
    if (!canEdit) return false;
    const day = addSelectedDay;
    const order = nextOrderForDay(day);
    const startTime = input.startTime === "" ? null : input.startTime;
    const duration = input.duration === "" ? null : Number(input.duration);
    const budget = input.budget === "" ? null : Number(input.budget);
    const optimistic: ItineraryItem = {
      id: -Date.now(),
      itinerary_id: itineraryId,
      destination_id: null,
      custom_title: input.title,
      custom_latitude: input.latitude,
      custom_longitude: input.longitude,
      custom_address: input.address === "" ? null : input.address,
      is_custom: true,
      title: input.title,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
      day_number: day,
      order,
      start_time: startTime,
      duration_minutes: duration,
      estimated_budget: budget,
      notes: null,
      visited: false,
      status: "planned",
      unavailable: false,
      verified: false,
    };

    return performAdd(
      {
        destination_id: null,
        custom_title: input.title,
        custom_latitude: input.latitude,
        custom_longitude: input.longitude,
        custom_address: input.address === "" ? null : input.address,
        day_number: day,
        order,
        start_time: startTime,
        duration_minutes: duration,
        category: input.category,
        estimated_budget: budget,
      },
      optimistic,
      `Added ${input.title} to Day ${day}`,
    );
  };

  if (loading) {
    return <PlannerSkeleton isMobile={isMobile} />;
  }

  if (loadError || !itinerary || !summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-lagoon-950 px-6 text-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="font-display text-xl font-semibold text-lagoon-900">This planner could not be loaded</h2>
          <p className="mt-1 text-sm text-ink-600">
            {loadError ?? "The trip is missing or you no longer have access to it."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={retryLoad}>Try again</Button>
            <Link
              to="/app/trips"
              className="rounded-full px-3 py-2 text-sm font-semibold text-sea-600 hover:bg-sand-100"
            >
              Back to my trips
            </Link>
          </div>
        </div>
        {loadError ? (
          <div className="w-full max-w-md">
            <InlineError message={loadError} />
          </div>
        ) : null}
      </div>
    );
  }

  const activeItem = activeId !== null ? items.find((item) => item.id === activeId) ?? null : null;
  const showEstimates = estimates?.enabled ?? false;
  const showDestinationMarkers = addOpen && addMode === "destination";

  const notice = remote ? (
    <div className="rounded-xl bg-mango-400/15 px-3 py-2 ring-1 ring-inset ring-mango-400/30">
      <p className="text-xs text-ink-800">
        <span className="font-semibold">{remote.updatedBy ?? "Someone"}</span> updated this trip while you were looking.
      </p>
      <div className="mt-2 flex gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setActivityOpen(true)}>
          Activity
        </Button>
        <Button size="sm" onClick={() => void handleLoadLatest()}>
          Refresh trip
        </Button>
      </div>
    </div>
  ) : null;
  const plannedIslandFallback = roadRoutes.routes.some((route) => {
    if (route.reason !== "no_road_route") return false;
    const dayItems = groups.find((group) => group.day === route.day)?.items ?? [];
    return dayItems.some((item, index) => index > 0 && (haversineMeters(dayItems[index - 1], item) ?? 0) >= 30_000);
  });
  const panelNotice = notice || plannedIslandFallback ? (
    <div className="space-y-2">
      {notice}
      {plannedIslandFallback ? (
        <p role="status" className="rounded-xl bg-mango-400/15 px-3 py-2 text-xs text-ink-800">
          This stop needs a ferry or boat. Showing a straight line.
        </p>
      ) : null}
    </div>
  ) : null;

  const nextStopPoint: [number, number] | null = nextStopItem?.latitude != null && nextStopItem.longitude != null
    ? [Number(nextStopItem.latitude), Number(nextStopItem.longitude)]
    : null;
  const liveDistance = livePosition && nextStopItem
    ? haversineMeters(
        { latitude: livePosition.lat, longitude: livePosition.lng },
        { latitude: nextStopItem.latitude, longitude: nextStopItem.longitude },
      )
    : null;
  const routeNeedsRetry = liveRoute.error !== null || liveRoute.route?.reason === "provider_unavailable" || liveRoute.route?.reason === "rate_limited";
  const islandRouteHint = liveRoute.route?.reason === "no_road_route" && liveDistance !== null && liveDistance >= 30_000
    ? "This stop needs a ferry or boat. Showing a straight line."
    : null;
  const locationStatus = livePosition === null
    ? null
    : livePosition.accuracy == null
      ? "GPS: unavailable"
      : livePosition.accuracy > 200
        ? "Weak GPS signal"
        : `GPS: ${livePosition.accuracy <= 30 ? "good" : "fair"}`;

  const remainingStops = items.filter((item) => item.status === "planned" || item.status === "arrived");
  const visitedCount = items.filter((item) => item.status === "done").length;
  const skippedCount = items.filter((item) => item.status === "skipped").length;
  const arrivalItem = arrivalStopId !== null ? items.find((item) => item.id === arrivalStopId) ?? null : null;
  const arrivalDistance =
    arrivalItem && liveTracking.position
      ? haversineMeters(
          { latitude: liveTracking.position.lat, longitude: liveTracking.position.lng },
          { latitude: arrivalItem.latitude, longitude: arrivalItem.longitude },
        )
      : null;

  const groupMembers = groupTracking.state?.members ?? [];
  const groupSharingCount = groupMembers.filter((member) => member.sharing).length;
  const meetPosition =
    groupSharing && liveTracking.position
      ? { lat: liveTracking.position.lat, lng: liveTracking.position.lng }
      : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div ref={mapContainerRef} className="relative h-full w-full overflow-hidden bg-sand-100">
        <TripMapCanvas
          items={items}
          activeItemId={selectedItemId}
          hoveredItemId={hoveredItemId}
          onSelectItem={selectItem}
          onHoverItem={setHoveredItemId}
          focusPoint={focus?.point ?? null}
          focusNonce={focus?.nonce ?? 0}
          pickMode={addOpen && addMode === "custom"}
          pickedPoint={addPickedPoint}
          onPickPoint={(lat, lng) => handlePickedPointChange({ lat, lng })}
          destinationMarkers={showDestinationMarkers ? filteredDestinations : []}
          activeDestinationId={hoveredDestinationId}
          hoveredDestinationId={hoveredDestinationId}
          onSelectDestination={(destination) => setHoveredDestinationId(destination.id)}
          onHoverDestination={setHoveredDestinationId}
          onAddDestination={addDestinationStop}
          insets={mapInsets}
          fitKey={`${itinerary.version ?? 0}-${items.length}`}
          fitLiveKey={livePosition ? itineraryId : 0}
          bottomInset={isMobile ? bottomChrome : 0}
          rightInset={zoomRightInset}
          livePosition={livePosition}
          traveledPath={isOngoing ? liveTracking.traveled : []}
          nextStopPoint={nextStopPoint}
          liveRoute={liveRoute.route}
          plannedRoutes={roadRoutes.routes}
          following={Boolean(livePosition) && followMap}
          onManualPan={() => setFollowMap(false)}
          partyMembers={groupSharing ? partyMembers : []}
          meetup={groupTracking.state?.meetup ?? null}
        />

        {livePosition && lifecycle !== "active" && lifecycle !== "paused" ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[920] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-white/95 px-4 py-2.5 text-xs text-lagoon-900 shadow-lg ring-1 ring-line/70 backdrop-blur" style={{ marginLeft: isMobile ? 0 : legendOffset }}>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
              <span className="font-semibold">Your current location</span>
              <span>{nextStopItem ? `Next: ${nextStopItem.title}` : "No stops remaining"}</span>
              {locationStatus ? <span className="text-ink-600">{locationStatus}</span> : null}
              {lifecycle === "planned" && currentLocation.error !== null ? (
                <span className="text-ink-600">Last updated {new Date(positionForMap?.recordedAt ?? "").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              ) : null}
            </div>
          </div>
        ) : !livePosition && lifecycle !== "active" && currentLocation.status === "locating" ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[920] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-lagoon-900 shadow-lg ring-1 ring-line/70">
            <Spinner className="h-4 w-4" /> Finding your location...
          </div>
        ) : null}

        {currentLocation.error && lifecycle === "planned" ? (
          <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-[920] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl bg-white/95 px-3 py-2 text-center text-xs text-amber-800 shadow ring-1 ring-amber-200">
            {currentLocation.error}
          </div>
        ) : null}

        {lifecycle === "active" && liveTracking.permission === "denied" ? (
          <div className="absolute left-1/2 top-[4.25rem] z-[930] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-amber-900 shadow ring-1 ring-amber-200">
            <span>Location permission is off. Enable it in site settings.</span>
            <button type="button" onClick={liveTracking.retryLocation} className="font-bold text-sea-700 underline">Retry</button>
          </div>
        ) : null}

        {livePosition && !followMap ? (
          <button
            type="button"
            onClick={() => {
              focusNonceRef.current += 1;
              setFocus({ point: [livePosition.lat, livePosition.lng], nonce: focusNonceRef.current });
              setFollowMap(true);
            }}
            className="absolute left-1/2 top-[4.25rem] z-[930] -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sea-700 shadow ring-1 ring-line/70"
          >
            Recenter
          </button>
        ) : null}

        <button
          ref={followingButtonRef}
          type="button"
          aria-label={followMap && livePosition ? "Stop following your location" : "Show my location"}
          title={followMap && livePosition ? "Following your location" : "My location"}
          className={cn(
            "absolute z-[930] flex select-none items-center rounded-full bg-white font-semibold text-sea-700 shadow-xl ring-1 ring-line/70 transition-colors hover:bg-sand-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surf-400 focus-visible:ring-offset-2",
            "touch-none",
            isFollowingDragging ? "cursor-grabbing" : "cursor-grab",
            "h-9 gap-1.5 px-3 text-xs md:h-12 md:gap-2 md:px-4 md:text-sm",
          )}
          style={
            followingButtonPos
              ? {
                  left: 0,
                  top: 0,
                  transform: `translate3d(${Math.round(followingButtonPos.x)}px, ${Math.round(followingButtonPos.y)}px, 0)`,
                }
              : isMobile
                ? { right: 16, bottom: bottomChrome + 84 }
                : { right: Math.max(16, rightMapInset + 10), bottom: 20 }
          }
          {...followingButtonBind}
        >
          <CrosshairIcon className="h-4 w-4 md:h-5 md:w-5" />
          {followMap && livePosition ? "Following" : "My location"}
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[880] flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            <Link
              to="/app/trips"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-lagoon-900 shadow-sm ring-1 ring-line/60 backdrop-blur hover:bg-white"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> My trips
            </Link>
            {!isMobile && panelHidden ? (
              <>
                <button
                  type="button"
                  onClick={() => setPanelHidden(false)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-lagoon-900 shadow-lg ring-1 ring-line/60 transition-colors hover:bg-sand-50"
                >
                  <LayersIcon className="h-4 w-4" /> Show trip
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    disabled={isOngoing}
                    aria-pressed={addOpen}
                    title={isOngoing ? "Pause or finish the trip to add stops" : undefined}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surf-400 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-surf-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusIcon className="h-4 w-4" /> Add a stop
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          {showEstimates ? (
            <div className="pointer-events-auto flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-ink-600 shadow-sm ring-1 ring-line/60 backdrop-blur">
                <RouteIcon className="h-3.5 w-3.5" /> Route estimates on
              </span>
            </div>
          ) : null}
        </div>

        {showLegend ? (
          <div
            className="pointer-events-none absolute top-3 z-[881] flex flex-col items-center sm:top-4"
            style={{ left: "50%", transform: `translateX(calc(-50% + ${legendOffset}px))` }}
          >
            <div className="pointer-events-auto max-w-[min(80vw,22rem)] overflow-hidden rounded-full bg-white/95 shadow-sm ring-1 ring-line/60 backdrop-blur">
              <button
                type="button"
                onClick={() => setLegendOpen((value) => !value)}
                aria-expanded={legendOpen}
                className="inline-flex h-8 items-center gap-1.5 px-3 text-[11px] font-semibold text-ink-600"
              >
                <span className="flex -space-x-1" aria-hidden="true">
                  {groups.slice(0, 5).map((group) => (
                    <span
                      key={group.day}
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-white"
                      style={{ backgroundColor: dayColor(group.day) }}
                    />
                  ))}
                </span>
                Legend
                <ChevronIcon
                  className={`h-3.5 w-3.5 transition-transform ${legendOpen ? "rotate-180" : ""}`}
                />
              </button>
              {legendOpen ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line/60 px-3 py-2">
                  {groups.map((group) => (
                    <span key={group.day} className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-600">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: dayColor(group.day) }}
                        aria-hidden="true"
                      />
                      Day {group.day}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[900]">
          <TripPanel
            itinerary={itinerary}
            summary={summary}
            groups={groups}
            canEdit={canEdit}
            isOwner={isOwner}
            isGroup={isGroup}
            busyItem={busyItem}
            estimatesEnabled={showEstimates}
            travelByLeg={travelByLeg}
            daySummaryByDay={daySummaryByDay}
            totalDistanceM={totalDistanceM}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            flashItemId={flashItemId}
            scrollRequest={scrollRequest}
            lifecycle={lifecycle}
            nextStopId={nextStopItem?.id ?? null}
            livePosition={livePosition}
            markingItemId={markingItemId}
            startBusy={lifecycleBusy}
            trackingActive={trackingEnabled}
            onStartTrip={() => setStartOpen(true)}
            onMarkVisited={(item) => void handleMarkVisited(item)}
            onSkipStop={(item) => void handleSkipStop(item)}
            onUndoStop={(item) => void handleUndoStop(item)}
            canUndoStop={canUndoStop}
            addOpen={addOpen}
            onOpenAdd={handleOpenAdd}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenTemplates={() => setTemplatesOpen(true)}
            onOpenShare={() => setShareOpen(true)}
            onExportError={setItemError}
            itemError={itemError}
            notice={panelNotice}
            party={
              isGroup ? (
                <GroupPartyPanel
                  state={groupTracking.state}
                  lifecycle={lifecycle}
                  loading={groupTracking.loading}
                  busy={groupTracking.busy}
                  error={groupTracking.error}
                  message={groupTracking.message}
                  transport={groupTracking.transport}
                  meetPosition={meetPosition}
                  onToggleSharing={(enabled) => void groupTracking.toggleSharing(enabled)}
                  onPinMeetup={handlePinMeetup}
                  onFocusMember={focusMember}
                  onFocusMeetup={focusMeetup}
                />
              ) : null
            }
            collapsed={panelCollapsed}
            hidden={panelHidden}
            width={effectivePanelWidth}
            resizable={isDesktop}
            onResize={handlePanelResize}
            onToggleCollapse={() => setPanelCollapsed((value) => !value)}
            onHide={() => setPanelHidden(true)}
            isMobile={isMobile}
            mobileSnap={mobileSnap}
            mobileHeight={mobileHeight}
            mobileBottomInset={bottomNavInset}
            onMobileSnapChange={setMobileSnap}
            onSelectItem={selectItem}
            onHoverItem={setHoveredItemId}
            onToggleStatus={handleToggleStatus}
            onEditItem={setEditingItem}
            onDeleteItem={handleDeleteItem}
            onFocusItem={focusItem}
          />

          {canEdit && addOpen && !isOngoing ? (
            <AddStopPanel
              isMobile={isMobile}
              width={addPanelWidth}
              destinations={destinations}
              filteredDestinations={filteredDestinations}
              destinationsLoading={destinationsLoading}
              destinationsError={destinationsError}
              addedDestinationIds={addedDestinationIds}
              hoveredDestinationId={hoveredDestinationId}
              mode={addMode}
              selectedDay={addSelectedDay}
              maxDay={maxDay}
              startTime={addStartTime}
              category={addCategory}
              adding={adding}
              addError={addError}
              sessionCount={addSessionCount}
              pickedPoint={addPickedPoint}
              mobileSnap={addMobileSnap}
              mobileHeight={addMobileHeight}
              mobileBottomInset={bottomNavInset}
              onClose={handleCloseAdd}
              onRetryDestinations={() => void loadDestinations()}
              onModeChange={handleAddModeChange}
              onSelectedDayChange={setAddSelectedDay}
              onNewDay={handleNewDay}
              onStartTimeChange={setAddStartTime}
              onCategoryChange={setAddCategory}
              onSearchChange={setAddSearch}
              onHoverDestination={setHoveredDestinationId}
              onAddDestination={addDestinationStop}
              onAddCustomStop={addCustomStop}
              onMobileSnapChange={setAddMobileSnap}
            />
          ) : null}
        </div>

        <TripLiveBar
          lifecycle={lifecycle}
          summary={tracking}
          startedAt={itinerary.started_at}
          totalPausedSeconds={itinerary.total_paused_seconds}
          isMobile={isMobile}
          bottomOffset={isMobile ? bottomChrome : 0}
          centerOffset={legendOffset}
          busy={lifecycleBusy}
          message={isGroup ? groupTracking.message : liveTracking.message}
          wakeLockNotice={liveTracking.wakeLockNotice}
          pendingCount={liveTracking.pendingCount}
          canFinish={tracking?.can_finish ?? itinerary.can_finish ?? false}
          canManage={!isGroup || canEdit}
          following={followMap}
          group={
            isGroup
              ? {
                  sharing: groupTracking.sharing,
                  sharingCount: groupSharingCount,
                  memberCount: groupMembers.length,
                  transport: groupTracking.transport,
                }
              : null
          }
          routeDistanceM={navigation.remainingDistanceM ?? liveRoute.route?.distance_m ?? null}
          routeDurationS={navigation.remainingDurationS ?? liveRoute.route?.duration_s ?? null}
          routeApproximate={liveRoute.route?.approximate ?? false}
          routeLoading={liveRoute.loading}
          routeHint={islandRouteHint}
          routeRetry={routeNeedsRetry ? liveRoute.retry : null}
          locationStatus={locationStatus}
          profile={routeProfile}
          onChangeProfile={setRouteProfile}
          nextManeuver={navigation.nextManeuver}
          isOffRoute={navigation.isOffRoute}
          alertsEnabled={alerts.notificationPermission === "granted"}
          onToggleAlerts={() => {
            if (alerts.notificationPermission !== "granted") {
              void alerts.requestNotificationPermission();
            }
          }}
          onToggleFollow={() => setFollowMap((value) => !value)}
          onPause={() => void handlePauseTrip()}
          onResume={() => void handleResumeTrip()}
          onFinish={handleOpenFinish}
        />

        {alerts.lastAlert ? (
          <div
            className="pointer-events-auto absolute left-1/2 z-[896] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-lagoon-900/95 px-3 py-2 text-white shadow-xl backdrop-blur transition-all"
            style={isMobile ? { bottom: bottomChrome + 120 } : { top: 96 }}
            role="alert"
          >
            <BellIcon className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs">
              <span className="font-semibold">{alerts.lastAlert.title}: </span>
              <span className="text-white/80">{alerts.lastAlert.body}</span>
            </div>
            <button
              type="button"
              onClick={alerts.dismissLastAlert}
              className="ml-2 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss alert"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {arrivalItem && lifecycle === "active" && (!isGroup || canEdit) ? (
          <div
            className="pointer-events-none absolute left-1/2 z-[895] -translate-x-1/2"
            style={isMobile ? { bottom: bottomChrome + 88 } : { top: 82 }}
          >
            <TripArrivalPrompt
              item={arrivalItem}
              distanceM={arrivalDistance}
              busy={markingItemId === arrivalItem.id}
              error={arrivalError}
              onMarkVisited={() => void handleMarkVisited(arrivalItem)}
              onNotYet={() => handleArrivalNotYet(arrivalItem)}
              onSkip={() => void handleSkipStop(arrivalItem)}
            />
          </div>
        ) : null}

        {finished && !summaryDismissed ? (
          <div
            className="pointer-events-none absolute z-[894]"
            style={isMobile ? { right: 12, bottom: bottomChrome + 88 } : { right: 16, bottom: 16 }}
          >
            <TripSummaryCard
              itinerary={{ ...itinerary, distance_m: tracking?.distance_m ?? itinerary.distance_m ?? 0 }}
              visitedCount={visitedCount}
              skippedCount={skippedCount}
              elapsedSeconds={tracking?.elapsed_seconds ?? 0}
              onDismiss={() => setSummaryDismissed(true)}
            />
          </div>
        ) : reviewCard && isOngoing ? (
          <div
            className="pointer-events-none absolute z-[894]"
            style={isMobile ? { right: 12, bottom: bottomChrome + 88 } : { right: 16, bottom: 16 }}
          >
            <TripReviewCard
              destinationId={reviewCard.destinationId}
              destinationName={reviewCard.name}
              onDismiss={() => setReviewCard(null)}
            />
          </div>
        ) : null}

        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-[1200]"
            style={
              isMobile
                ? { left: "50%", top: 12, transform: "translateX(-50%)" }
                : {
                    left: "50%",
                    bottom: 24,
                    transform: `translateX(calc(-50% + ${legendOffset}px))`,
                  }
            }
          >
            <div className="rounded-full bg-lagoon-900 px-4 py-2 text-sm font-semibold text-sand-50 shadow-xl">
              {toast}
            </div>
          </div>
        ) : null}

        <DragOverlay>
          {activeItem ? (
            <div className="rounded-xl bg-white p-3 opacity-95 shadow-xl ring-1 ring-line/60">
              <p className="text-sm font-semibold text-ink-900">{activeItem.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </div>

      <ShareDialog
        open={shareOpen}
        itinerary={itinerary}
        onClose={() => setShareOpen(false)}
        onChanged={refresh}
        onLeft={() => navigate("/app/trips")}
        onConflict={(fresh) => setConflict({ message: "This trip changed while you were updating it.", itinerary: fresh })}
      />

      <TripStartDialog
        open={startOpen}
        itinerary={itinerary}
        stopCount={items.length}
        busy={lifecycleBusy}
        locating={currentLocation.status === "locating"}
        locationError={currentLocation.error}
        error={lifecycleError}
        onClose={() => setStartOpen(false)}
        onConfirm={() => void handleStartTrip()}
        onStartWithoutLocation={() => void handleStartWithoutLocation()}
      />

      <TripPauseSheet
        open={pauseOpen}
        remainingCount={remainingStops.length}
        maxDay={summary.day_count}
        busy={lifecycleBusy}
        error={lifecycleError}
        onClose={() => setPauseOpen(false)}
        onShift={(minutes) => void handleReschedule({ strategy: "shift", minutes })}
        onMoveDay={(day) => void handleReschedule({ strategy: "move_day", day_number: day })}
        onFinish={() => {
          setPauseOpen(false);
          handleOpenFinish();
        }}
      />

      <TripFinishDialog
        open={finishOpen}
        remaining={remainingStops}
        visitedCount={visitedCount}
        totalStops={items.length}
        busy={lifecycleBusy}
        error={lifecycleError}
        onClose={() => setFinishOpen(false)}
        onConfirm={() => void handleFinishTrip()}
      />

      <Modal
        open={duplicateDestination !== null}
        onClose={() => setDuplicateDestination(null)}
        title="Already in this trip"
        description="Add the same destination a second time?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicateDestination(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAddAgain}>Add anyway</Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          <span className="font-semibold text-ink-900">{duplicateDestination?.name}</span> is already a stop on this
          trip. Add it again to Day {addSelectedDay}?
        </p>
      </Modal>

      <Modal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title="Trip activity"
        description="Who changed what, and when."
        size="md"
      >
        {activityLoading ? (
          <p className="py-6 text-center text-sm text-ink-600">Loading activity...</p>
        ) : activities.length === 0 && remote?.activities.length ? (
          <ActivityList activities={remote.activities} />
        ) : activities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-600">
            No activity yet. Edits, members and sharing changes will show up here.
          </p>
        ) : (
          <ActivityList activities={activities} />
        )}
      </Modal>

      <Modal
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="This trip changed"
        description="Your change was not saved because someone else updated the trip first."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Keep editing
            </Button>
            <Button onClick={() => void handleLoadLatest()}>Load latest version</Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {conflict?.message ?? "Refresh to get the newest stops and settings before trying again."}
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Your unsaved text stays in the editor until you close it, so you can copy it before refreshing.
        </p>
      </Modal>

      <StopEditor
        open={canEdit && editingItem !== null}
        itinerary={itinerary}
        item={editingItem}
        destinations={destinations}
        onClose={() => setEditingItem(null)}
        onSaved={async () => {
          await refresh();
          setEditingItem(null);
        }}
        onConflict={(stale) => setConflict({ message: stale.message, itinerary: stale.itinerary })}
      />

      <SettingsDialog
        open={settingsOpen}
        itinerary={itinerary}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onConflict={(stale) => setConflict({ message: stale.message, itinerary: stale.itinerary })}
      />

      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </DndContext>
  );
}

function PlannerSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-sand-100">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-sand-200 via-sand-100 to-surf-400/30" />
      <div className="absolute left-4 top-4 h-24 w-64 animate-pulse rounded-2xl bg-white/80 shadow-lg" />
      {isMobile ? (
        <div className="absolute inset-x-0 bottom-0 h-[56%] animate-pulse rounded-t-3xl bg-white/90 shadow-2xl" />
      ) : (
        <div className="absolute bottom-4 left-4 top-4 w-[520px] animate-pulse rounded-2xl bg-white/90 shadow-2xl" />
      )}
    </div>
  );
}

const ACTIVITY_LABEL: Record<string, string> = {
  created: "created this trip",
  updated: "updated trip details",
  item_added: "added a stop",
  item_updated: "updated a stop",
  item_removed: "removed a stop",
  items_reordered: "reordered stops",
  member_invited: "invited a traveller",
  member_joined: "joined the trip",
  member_removed: "removed a traveller",
  member_left: "left the trip",
  role_changed: "changed a member role",
  ownership_transferred: "transferred ownership",
  invite_link_created: "created a share link",
  invite_link_revoked: "revoked a share link",
  budget_visibility_changed: "changed budget visibility",
  rsvp_updated: "updated their RSVP",
};

function ActivityList({ activities }: { activities: ItineraryActivity[] }) {
  return (
    <ol className="space-y-1">
      {activities.map((activity) => (
        <li key={activity.id} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-sand-100/60">
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lagoon-900 text-sand-50">
            <ClockIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-800">
              <span className="font-semibold">{activity.user ?? "Someone"}</span>{" "}
              {ACTIVITY_LABEL[activity.action] ?? activity.action.replaceAll("_", " ")}
            </p>
            <p className="text-xs text-ink-500">
              {activity.created_at ? new Date(activity.created_at).toLocaleString() : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface SettingsPayload {
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: string | number | null;
  cover_image_url: string | null;
}

interface SettingsDialogProps {
  open: boolean;
  itinerary: Itinerary;
  onClose: () => void;
  onSave: (payload: SettingsPayload) => Promise<void>;
  onConflict: (conflict: { message: string; itinerary: Itinerary }) => void;
}

function SettingsDialog({ open, itinerary, onClose, onSave, onConflict }: SettingsDialogProps) {
  const [title, setTitle] = useState(itinerary.title);
  const [description, setDescription] = useState(itinerary.description ?? "");
  const [startDate, setStartDate] = useState(itinerary.start_date ?? "");
  const [endDate, setEndDate] = useState(itinerary.end_date ?? "");
  const [budget, setBudget] = useState(itinerary.budget_limit !== null ? String(itinerary.budget_limit) : "");
  const [cover, setCover] = useState(itinerary.cover_image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-seed fields each time the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(itinerary.title);
    setDescription(itinerary.description ?? "");
    setStartDate(itinerary.start_date ?? "");
    setEndDate(itinerary.end_date ?? "");
    setBudget(itinerary.budget_limit !== null ? String(itinerary.budget_limit) : "");
    setCover(itinerary.cover_image_url ?? "");
    setError(null);
  }, [open, itinerary]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description === "" ? null : description,
        start_date: startDate === "" ? null : startDate,
        end_date: endDate === "" ? null : endDate,
        total_budget: budget === "" ? null : Number(budget),
        cover_image_url: cover === "" ? null : cover,
      });
      onClose();
    } catch (saveError) {
      const stale = apiConflict(saveError);
      if (stale) onConflict({ message: stale.message, itinerary: stale.itinerary });
      else setError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={saving} title="Trip settings" description="Rename, date and budget this plan.">
      <form id="trip-settings-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Trip name" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-900">Description</p>
          <textarea
            className="min-h-20 w-full rounded-xl bg-white/70 px-4 py-3 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400"
            value={description}
            maxLength={2000}
            placeholder="What's this trip about?"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="End date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          <Input
            label="Budget limit (₱)"
            type="number"
            min={0}
            placeholder="No limit"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
          <Input label="Cover image URL" value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" />
        </div>
        {error ? <InlineError message={error} /> : null}
      </form>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form="trip-settings-form" disabled={saving || title.trim() === ""}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}
