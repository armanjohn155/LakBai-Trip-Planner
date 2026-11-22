import { toNumber } from "@/lib/format";
import type { Destination } from "@/lib/types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export interface NearbyDestination {
  destination: Destination;
  distanceKm: number;
}

export function nearestDestinations(destination: Destination, all: Destination[], limit = 4): NearbyDestination[] {
  const lat = toNumber(destination.latitude);
  const lng = toNumber(destination.longitude);
  return all
    .filter((candidate) => candidate.id !== destination.id)
    .map((candidate) => ({
      destination: candidate,
      distanceKm: haversineKm(lat, lng, toNumber(candidate.latitude), toNumber(candidate.longitude)),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export interface LatLngLike {
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
}

/** Great-circle distance in metres between two coordinates. */
export function haversineMeters(from: LatLngLike, to: LatLngLike): number | null {
  if (from.latitude == null || from.longitude == null || to.latitude == null || to.longitude == null) {
    return null;
  }

  const lat1 = Number(from.latitude);
  const lng1 = Number(from.longitude);
  const lat2 = Number(to.latitude);
  const lng2 = Number(to.longitude);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/**
 * Rough Cebu road-trip estimate used only when the route service is off or has
 * no leg data. Straight-line distance at an average 30 km/h, never below a
 * minute so short hops still read as a drive.
 */
export function approximateDriveMinutes(distanceM: number | null): number | null {
  if (distanceM === null) return null;
  return Math.max(1, Math.round((distanceM / 1000 / 30) * 60));
}

export function formatDistance(distanceM: number | null): string | null {
  if (distanceM === null || !Number.isFinite(distanceM)) return null;
  if (distanceM >= 1000) return `${(distanceM / 1000).toFixed(1)} km`;
  return `${Math.round(distanceM)} m`;
}

export function profileFallbackSpeedKmh(profile?: string): number {
  switch (profile) {
    case "walking":
      return 5;
    case "cycling":
      return 15;
    default:
      return 30;
  }
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Distance in meters from a point {lat, lng} to a line segment A -> B.
 * Returns perpendicular distance, parameter t (0..1), and projected coordinate.
 */
export function pointSegmentDistanceMeters(
  point: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): { distanceM: number; t: number; point: { lat: number; lng: number } } {
  const lat0 = (point.lat * Math.PI) / 180;
  const scaleX = Math.cos(lat0) * EARTH_RADIUS_M;
  const scaleY = EARTH_RADIUS_M;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const px = toRad(point.lng) * scaleX;
  const py = toRad(point.lat) * scaleY;
  const ax = toRad(a.lng) * scaleX;
  const ay = toRad(a.lat) * scaleY;
  const bx = toRad(b.lng) * scaleX;
  const by = toRad(b.lat) * scaleY;

  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  const t = denom === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom));

  const projLat = a.lat + t * (b.lat - a.lat);
  const projLng = a.lng + t * (b.lng - a.lng);
  const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));

  return { distanceM: dist, t, point: { lat: projLat, lng: projLng } };
}

/**
 * Snaps a point to a GeoJSON LineString coordinates array ([[lng, lat], ...])
 * finding minimum distance in meters and segment index.
 */
export function snapToPolyline(
  point: { lat: number; lng: number },
  coordinates: [number, number][],
): { minDistanceM: number; segmentIndex: number; projectedPoint: { lat: number; lng: number } } | null {
  if (coordinates.length < 2) return null;

  let minDistanceM = Number.POSITIVE_INFINITY;
  let segmentIndex = 0;
  let bestPoint = { lat: coordinates[0][1], lng: coordinates[0][0] };

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = { lat: coordinates[i][1], lng: coordinates[i][0] };
    const b = { lat: coordinates[i + 1][1], lng: coordinates[i + 1][0] };
    const result = pointSegmentDistanceMeters(point, a, b);

    if (result.distanceM < minDistanceM) {
      minDistanceM = result.distanceM;
      segmentIndex = i;
      bestPoint = result.point;
    }
  }

  return { minDistanceM, segmentIndex, projectedPoint: bestPoint };
}

/**
 * Calculates remaining distance in meters along the polyline from
 * segmentIndex and projectedPoint to the end of the route.
 */
export function remainingDistanceOnPolyline(
  coordinates: [number, number][],
  segmentIndex: number,
  projectedPoint: { lat: number; lng: number },
): number {
  if (coordinates.length < 2) return 0;
  if (segmentIndex >= coordinates.length - 1) return 0;

  // First partial segment: from projectedPoint to coordinates[segmentIndex + 1]
  const nextPt = { lat: coordinates[segmentIndex + 1][1], lng: coordinates[segmentIndex + 1][0] };
  let remainingM = haversineKm(projectedPoint.lat, projectedPoint.lng, nextPt.lat, nextPt.lng) * 1000;

  // Remaining full segments
  for (let i = segmentIndex + 1; i < coordinates.length - 1; i++) {
    const p1 = { lat: coordinates[i][1], lng: coordinates[i][0] };
    const p2 = { lat: coordinates[i + 1][1], lng: coordinates[i + 1][0] };
    remainingM += haversineKm(p1.lat, p1.lng, p2.lat, p2.lng) * 1000;
  }

  return Math.round(remainingM);
}
