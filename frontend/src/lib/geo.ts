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
