import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  haversineKm,
  profileFallbackSpeedKmh,
  remainingDistanceOnPolyline,
  snapToPolyline,
} from "@/lib/geo";
import type { RouteGeometryResponse, RouteInstruction, RouteProfile } from "@/lib/types";

export interface NavigationManeuver {
  instruction: string;
  distance_m: number;
  duration_s?: number;
  type?: string;
  modifier?: string | null;
  street?: string | null;
  location?: [number, number] | null;
}

export interface UseNavigationOptions {
  livePosition: { lat: number; lng: number; heading?: number | null; speed?: number | null } | null;
  route: RouteGeometryResponse | null;
  enabled: boolean;
  profile?: RouteProfile;
  deviationThresholdM?: number;
  onOffRoute?: () => void;
}

export interface UseNavigationResult {
  isOffRoute: boolean;
  crossTrackDistanceM: number | null;
  remainingDistanceM: number | null;
  remainingDurationS: number | null;
  progressPercent: number;
  nextManeuver: NavigationManeuver | null;
  allManeuvers: NavigationManeuver[];
  triggerReroute: () => void;
  rerouteNonce: number;
}

const DEFAULT_DEVIATION_THRESHOLD_M = 50;
const OFF_ROUTE_CONFIRMATION_FIXES = 2;

export function useNavigation({
  livePosition,
  route,
  enabled,
  profile = "driving",
  deviationThresholdM = DEFAULT_DEVIATION_THRESHOLD_M,
  onOffRoute,
}: UseNavigationOptions): UseNavigationResult {
  const [rerouteNonce, setRerouteNonce] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const offRouteFixesCountRef = useRef(0);
  const lastRerouteCallRef = useRef(0);

  const coordinates = route?.geometry?.coordinates ?? null;
  const instructions = route?.instructions ?? null;

  const triggerReroute = useCallback(() => {
    const now = Date.now();
    if (now - lastRerouteCallRef.current >= 8_000) {
      lastRerouteCallRef.current = now;
      setRerouteNonce((prev) => prev + 1);
      onOffRoute?.();
    }
  }, [onOffRoute]);

  // Project live position onto the route polyline
  const snapResult = useMemo(() => {
    if (!enabled || !livePosition || !coordinates || coordinates.length < 2) {
      return null;
    }
    return snapToPolyline({ lat: livePosition.lat, lng: livePosition.lng }, coordinates);
  }, [enabled, livePosition, coordinates]);

  const crossTrackDistanceM = snapResult ? Math.round(snapResult.minDistanceM) : null;

  // Detect off-route deviation
  useEffect(() => {
    if (!enabled || crossTrackDistanceM === null) {
      offRouteFixesCountRef.current = 0;
      setIsOffRoute(false);
      return;
    }

    if (crossTrackDistanceM > deviationThresholdM) {
      offRouteFixesCountRef.current += 1;
      if (offRouteFixesCountRef.current >= OFF_ROUTE_CONFIRMATION_FIXES) {
        setIsOffRoute(true);
        triggerReroute();
      }
    } else {
      offRouteFixesCountRef.current = 0;
      setIsOffRoute(false);
    }
  }, [enabled, crossTrackDistanceM, deviationThresholdM, triggerReroute]);

  // Compute remaining distance & duration
  const { remainingDistanceM, remainingDurationS, progressPercent } = useMemo(() => {
    if (!route || !coordinates || coordinates.length < 2) {
      return {
        remainingDistanceM: route?.distance_m ?? null,
        remainingDurationS: route?.duration_s ?? null,
        progressPercent: 0,
      };
    }

    if (!snapResult || isOffRoute) {
      return {
        remainingDistanceM: route.distance_m,
        remainingDurationS: route.duration_s,
        progressPercent: 0,
      };
    }

    const remainingM = remainingDistanceOnPolyline(
      coordinates,
      snapResult.segmentIndex,
      snapResult.projectedPoint,
    );

    // Speed calculation: prefer device speed if above walking threshold (> 1.2 m/s), else profile fallback
    const speedKmh = profileFallbackSpeedKmh(profile);
    const fallbackSpeedMs = (speedKmh * 1000) / 3600;
    const deviceSpeedMs = livePosition?.speed;
    const activeSpeedMs =
      deviceSpeedMs != null && deviceSpeedMs > 1.2 && Number.isFinite(deviceSpeedMs)
        ? deviceSpeedMs
        : fallbackSpeedMs;

    const remainingS = Math.max(0, Math.round(remainingM / activeSpeedMs));
    const totalM = route.distance_m;
    const percent =
      totalM > 0 ? Math.min(100, Math.max(0, Math.round(((totalM - remainingM) / totalM) * 100))) : 0;

    return {
      remainingDistanceM: remainingM,
      remainingDurationS: remainingS,
      progressPercent: percent,
    };
  }, [route, coordinates, snapResult, isOffRoute, profile, livePosition?.speed]);

  // Maneuver tracking
  const { nextManeuver, allManeuvers } = useMemo(() => {
    if (!instructions || instructions.length === 0 || !livePosition) {
      return { nextManeuver: null, allManeuvers: [] };
    }

    const mapped: NavigationManeuver[] = instructions.map((step: RouteInstruction) => {
      let stepDistance = step.distance_m;
      if (step.location && step.location.length >= 2) {
        const [lng, lat] = step.location;
        stepDistance = Math.round(haversineKm(livePosition.lat, livePosition.lng, lat, lng) * 1000);
      }
      return {
        instruction: step.instruction,
        distance_m: stepDistance,
        duration_s: step.duration_s,
        type: step.type,
        modifier: step.modifier,
        street: step.street,
        location: step.location,
      };
    });

    // Find the next upcoming maneuver (first one with positive distance > 15m, or the first one if all close)
    const upcoming = mapped.find((m) => m.distance_m > 15) ?? mapped[0] ?? null;

    return { nextManeuver: upcoming, allManeuvers: mapped };
  }, [instructions, livePosition]);

  return {
    isOffRoute,
    crossTrackDistanceM,
    remainingDistanceM,
    remainingDurationS,
    progressPercent,
    nextManeuver,
    allManeuvers,
    triggerReroute,
    rerouteNonce,
  };
}
