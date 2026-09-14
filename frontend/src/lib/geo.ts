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