import { useEffect, useMemo } from "react";

import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";

import { createNumberedPin, dayColor } from "@/components/features/map/map-pin";
import { cn } from "@/lib/cn";
import type { RecapRoute, RecapStop, TripPhoto } from "@/lib/types";

import { resolveRecapMediaUrl } from "./recap-utils";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

const photoPin = L.divIcon({
  className: "recap-photo-pin",
  html: '<span style="display:flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;border:2px solid #0A3330;color:#14B8A6;font-size:11px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.35)" aria-hidden="true">●</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitToRecap({ points, signature }: { points: Array<[number, number]>; signature: string }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    if (!bounds.isValid()) return;
    map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
    // signature stands in for the point array so a re-render with equal data
    // does not reset a pan/zoom the reader just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  return null;
}

function FocusStop({ point, nonce }: { point: [number, number] | null; nonce: number }) {
  const map = useMap();

  useEffect(() => {
    if (!point) return;
    map.flyTo(point, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, point, nonce]);

  return null;
}

interface RecapMapProps {
  route: RecapRoute;
  stops: RecapStop[];
  photos: TripPhoto[];
  hideEndpoints?: boolean;
  className?: string;
  interactive?: boolean;
  onSelectStop?: (stopId: number) => void;
  /** Pan the map to a stop; bump `focusNonce` to repeat the same target. */
  focusPoint?: [number, number] | null;
  focusNonce?: number;
}

/**
 * Read-only story map: route lines coloured per day, numbered stop pins and a
 * small photo pin for every stop that has gallery photos.
 */
export function RecapMap({
  route,
  stops,
  photos,
  hideEndpoints = false,
  className,
  interactive = true,
  onSelectStop,
  focusPoint = null,
  focusNonce = 0,
}: RecapMapProps) {
  const orderedStops = useMemo(
    () => [...stops].sort((a, b) => a.day_number - b.day_number || a.order - b.order),
    [stops],
  );

  const photoCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const photo of photos) {
      if (photo.itinerary_item_id === null) continue;
      counts.set(photo.itinerary_item_id, (counts.get(photo.itinerary_item_id) ?? 0) + 1);
    }
    return counts;
  }, [photos]);

  const lines = useMemo(
    () =>
      route.features
        .filter((feature) => feature.geometry?.type === "LineString" && feature.geometry.coordinates.length >= 2)
        .map((feature, index) => ({
          key: `${feature.properties?.day ?? 1}-${feature.properties?.sequence ?? index}-${index}`,
          day: feature.properties?.day ?? 1,
          positions: feature.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
        })),
    [route],
  );

  const points = useMemo(() => {
    const all: Array<[number, number]> = [];
    for (const line of lines) all.push(...line.positions);
    for (const stop of orderedStops) {
      if (stop.latitude !== null && stop.longitude !== null) {
        all.push([stop.latitude, stop.longitude]);
      }
    }
    return all;
  }, [lines, orderedStops]);

  const signature = useMemo(
    () => `${points.length}:${points[0]?.join(",") ?? ""}:${points[points.length - 1]?.join(",") ?? ""}`,
    [points],
  );

  const hasRoute = points.length > 0;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-sand-100", className)}>
      <MapContainer
        center={hasRoute ? points[0] : CEBU_CENTER}
        zoom={11}
        zoomControl={false}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <FitToRecap points={points} signature={signature} />
        <FocusStop point={focusPoint} nonce={focusNonce} />
        <ZoomControl position="bottomright" />

        {lines.map((line) => (
          <Polyline
            key={line.key}
            positions={line.positions}
            pathOptions={{ color: dayColor(line.day), weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
          />
        ))}

        {orderedStops.map((stop, index) => {
          if (stop.latitude === null || stop.longitude === null) return null;
          const photosHere = photoCounts.get(stop.id) ?? 0;

          return (
            <Marker
              key={stop.id}
              position={[stop.latitude, stop.longitude]}
              icon={createNumberedPin(index + 1, dayColor(stop.day_number))}
              eventHandlers={{ click: () => onSelectStop?.(stop.id) }}
            >
              <Popup>
                <div className="min-w-40">
                  {stop.image_url ? (
                    <img
                      src={resolveRecapMediaUrl(stop.image_url) ?? undefined}
                      alt=""
                      className="mb-1.5 h-24 w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <p className="text-sm font-semibold text-lagoon-900">{stop.title}</p>
                  <p className="text-xs text-ink-600">
                    Day {stop.day_number}
                    {stop.municipality ? ` · ${stop.municipality}` : ""}
                    {photosHere > 0 ? ` · ${photosHere} ${photosHere === 1 ? "photo" : "photos"}` : ""}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {orderedStops.map((stop) => {
          const photosHere = photoCounts.get(stop.id) ?? 0;
          if (photosHere === 0 || stop.latitude === null || stop.longitude === null) return null;

          return (
            <Marker key={`photo-${stop.id}`} position={[stop.latitude, stop.longitude]} icon={photoPin} zIndexOffset={-50}>
              <Popup>
                <p className="text-sm font-semibold text-lagoon-900">
                  {photosHere} {photosHere === 1 ? "photo" : "photos"} at {stop.title}
                </p>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {hideEndpoints ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[15rem] rounded-full bg-lagoon-950/75 px-3 py-1.5 text-[11px] font-medium text-sand-50 backdrop-blur-sm">
          Start and end hidden for privacy
        </div>
      ) : null}
    </div>
  );
}
