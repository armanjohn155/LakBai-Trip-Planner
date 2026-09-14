import { useCallback, useEffect, useRef, type ReactNode } from "react";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { Destination } from "@/lib/types";
import { activePin, defaultPin } from "@/components/features/map/map-pin";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

interface CebuMapProps {
  destinations: Destination[];
  activeId?: number | null;
  focusId?: number | null;
  onSelect?: (destination: Destination) => void;
  onHover?: (destinationId: number) => void;
  onHoverEnd?: () => void;
  popup?: (destination: Destination) => ReactNode;
  className?: string;
  interactive?: boolean;
}

function FitBounds({ destinations, skip }: { destinations: Destination[]; skip: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (skip) return;
    if (destinations.length === 0) {
      map.setView(CEBU_CENTER, 9);
      return;
    }
    const bounds = L.latLngBounds(destinations.map((d) => [Number(d.latitude), Number(d.longitude)]));
    map.fitBounds(bounds.pad(0.25), { animate: false });
  }, [destinations, map, skip]);

  return null;
}

function FlyToDestination({ destinations, focusId }: { destinations: Destination[]; focusId: number }) {
  const map = useMap();

  useEffect(() => {
    const destination = destinations.find((d) => d.id === focusId);
    if (!destination) return;
    map.flyTo([Number(destination.latitude), Number(destination.longitude)], Math.max(map.getZoom(), 11), { duration: 0.8 });
  }, [destinations, focusId, map]);

  return null;
}

function ClickToSelect({ onSelect, destinations }: { onSelect: (d: Destination) => void; destinations: Destination[] }) {
  const handler = useCallback(
    (event: L.LeafletMouseEvent) => {
      const clicked = L.latLng(event.latlng.lat, event.latlng.lng);
      let best: Destination | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const destination of destinations) {
        const point = L.latLng(Number(destination.latitude), Number(destination.longitude));
        const distance = clicked.distanceTo(point);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = destination;
        }
      }

      if (best && bestDistance < 30_000) {
        onSelect(best);
      }
    },
    [destinations, onSelect],
  );

  useMapEvents({ click: handler });
  return null;
}

export function CebuMap({ destinations, activeId, focusId = null, onSelect, onHover, onHoverEnd, popup, className, interactive = true }: CebuMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={className}>
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
        <FitBounds destinations={destinations} skip={focusId !== null} />
        {focusId !== null ? <FlyToDestination destinations={destinations} focusId={focusId} /> : null}
        {interactive ? <ClickToSelect onSelect={onSelect ?? (() => {})} destinations={destinations} /> : null}
        {destinations.map((destination) => (
          <Marker
            key={destination.id}
            position={[Number(destination.latitude), Number(destination.longitude)]}
            icon={destination.id === activeId ? activePin : defaultPin}
            eventHandlers={{
              click: () => onSelect?.(destination),
              mouseover: () => onHover?.(destination.id),
              mouseout: () => onHoverEnd?.(),
            }}
            title={destination.name}
          >
            {popup ? <Popup closeButton={false} maxWidth={280} autoPan={false}>{popup(destination)}</Popup> : null}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}