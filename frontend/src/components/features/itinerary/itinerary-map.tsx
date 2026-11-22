import { useEffect, useMemo, type ReactNode } from "react";

import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { createNumberedPin, dayColor } from "@/components/features/map/map-pin";
import type { ItineraryItem } from "@/lib/types";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

interface ItineraryMapProps {
  items: ItineraryItem[];
  activeItemId?: number | null;
  onSelectItem?: (item: ItineraryItem) => void;
  onPickPoint?: (lat: number, lng: number) => void;
  pickedPoint?: { lat: number; lng: number } | null;
  className?: string;
  interactive?: boolean;
  followActive?: boolean;
}

function FitToStops({ points, pointKey }: { points: [number, number][]; pointKey: string }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(CEBU_CENTER, 9);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12), { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points).pad(0.2), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, map]);

  return null;
}

function FollowActive({ item, enabled }: { item: ItineraryItem | null; enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !item || item.latitude === null || item.longitude === null) return;
    map.flyTo([Number(item.latitude), Number(item.longitude)], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [enabled, item, map]);

  return null;
}

function ClickToPick({ onPickPoint }: { onPickPoint?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPickPoint?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function ItineraryMap({
  items,
  activeItemId = null,
  onSelectItem,
  onPickPoint,
  pickedPoint = null,
  className,
  interactive = true,
  followActive = false,
}: ItineraryMapProps) {
  const located = useMemo(
    () => items.filter((item) => item.latitude !== null && item.longitude !== null),
    [items],
  );
  const points: [number, number][] = useMemo(
    () => located.map((item) => [Number(item.latitude), Number(item.longitude)]),
    [located],
  );
  const pointKey = useMemo(
    () => located.map((item) => `${Number(item.latitude).toFixed(5)},${Number(item.longitude).toFixed(5)}`).join("|"),
    [located],
  );
  const activeItem = located.find((item) => item.id === activeItemId) ?? null;

  // Sequence markers 1..n across located items so pins never skip numbers on the map.
  const orderedLocated = useMemo(
    () => [...located].sort((a, b) => a.day_number - b.day_number || a.order - b.order),
    [located],
  );
  const sequence = useMemo(() => {
    const seq = new Map<number, number>();
    orderedLocated.forEach((item, index) => seq.set(item.id, index + 1));
    return seq;
  }, [orderedLocated]);

  const days = [...new Set(located.map((item) => item.day_number))].sort((a, b) => a - b);

  const paths = days
    .map((day) => ({
      day,
      items: located.filter((item) => item.day_number === day),
    }))
    .filter(({ items: dayItems }) => dayItems.length > 1)
    .map(({ day, items: dayItems }) => ({
      day,
      points: dayItems.map((item) => [Number(item.latitude), Number(item.longitude)] as [number, number]),
    }));

  return (
    <div className={className}>
      <MapContainer
        center={CEBU_CENTER}
        zoom={9}
        zoomControl={false}
        scrollWheelZoom={interactive}
        dragging={interactive}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <FitToStops points={points} pointKey={pointKey} />
        <FollowActive item={activeItem} enabled={followActive} />
        {onPickPoint ? <ClickToPick onPickPoint={onPickPoint} /> : null}

        {paths.map((path) => (
          <Polyline
            key={`day-${path.day}`}
            positions={path.points}
            pathOptions={{ color: dayColor(path.day), weight: 3, opacity: 0.75, dashArray: "6 8" }}
          />
        ))}

        {located.map((item) => {
          const label = sequence.get(item.id) ?? item.order;
          const icon = createNumberedPin(label, dayColor(item.day_number));
          const content: ReactNode = (
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-lagoon-900">{item.title}</p>
              <p className="text-xs text-ink-600">Day {item.day_number}</p>
            </div>
          );

          return (
            <Marker
              key={item.id}
              position={[Number(item.latitude), Number(item.longitude)]}
              icon={icon}
              eventHandlers={{ click: () => onSelectItem?.(item) }}
            >
              {onSelectItem ? <Popup closeButton={false} maxWidth={220} autoPan={false}>{content}</Popup> : null}
            </Marker>
          );
        })}

        {pickedPoint ? (
          <Marker position={[pickedPoint.lat, pickedPoint.lng]} opacity={0.9}>
            <Popup closeButton={false} maxWidth={200} autoPan={false}>
              <p className="text-xs text-ink-600">New custom stop</p>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
