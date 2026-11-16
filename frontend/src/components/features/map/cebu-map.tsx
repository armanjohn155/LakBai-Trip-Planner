import { useCallback, useEffect, useRef, type ReactNode } from "react";

import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";

import type { Destination, RouteGeometryResponse } from "@/lib/types";
import { activePin, defaultPin } from "@/components/features/map/map-pin";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

function numberedCircle(number: number): L.DivIcon {
  return L.divIcon({
    className: "route-stop-circle",
    html: `<span style="display:grid;width:32px;height:32px;place-items:center;border:3px solid white;border-radius:9999px;background:#0284c7;color:white;font:700 13px/1 system-ui,sans-serif;box-shadow:0 2px 8px #0b303855">${number}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const liveLocationIcon = L.divIcon({
  className: "live-location-dot",
  html: '<span style="display:block;width:18px;height:18px;border:4px solid white;border-radius:9999px;background:#0284c7;box-shadow:0 0 0 5px #0284c744,0 2px 8px #0b303855"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

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
  route?: RouteGeometryResponse | null;
  liveRoute?: RouteGeometryResponse | null;
  routeStops?: { name: string; lat: number; lng: number }[];
  livePosition?: { lat: number; lng: number; accuracy: number | null } | null;
  zoomControlPosition?: L.ControlPosition;
  bottomInset?: number;
}

function FitBounds({ destinations, route, skip, bottomInset }: { destinations: Destination[]; route: RouteGeometryResponse | null; skip: boolean; bottomInset: number }) {
  const map = useMap();

  useEffect(() => {
    if (skip) return;
    if (destinations.length === 0) {
      map.setView(CEBU_CENTER, 9);
      return;
    }
    const routePoints = route?.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];
    const points = routePoints.length > 1 ? routePoints : destinations.map((d) => [Number(d.latitude), Number(d.longitude)] as [number, number]);
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.25), { animate: false, paddingTopLeft: [12, 12], paddingBottomRight: [12, bottomInset + 12] });
  }, [destinations, map, route, skip, bottomInset]);

  return null;
}

function WatchMapSize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver?.observe(container);
    window.addEventListener("resize", handleResize);
    function handleResize() {
      map.invalidateSize({ pan: false });
    }
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

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

export function CebuMap({ destinations, activeId, focusId = null, onSelect, onHover, onHoverEnd, popup, className, interactive = true, route = null, liveRoute = null, routeStops = [], livePosition = null, zoomControlPosition = "bottomright", bottomInset = 0 }: CebuMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleDestinations = destinations.filter((destination) => !routeStops.some((stop) =>
    Math.abs(Number(destination.latitude) - stop.lat) < 0.0001 && Math.abs(Number(destination.longitude) - stop.lng) < 0.0001,
  ));

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
        <WatchMapSize />
        <ZoomControl position={zoomControlPosition} />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds destinations={destinations} route={route} skip={focusId !== null && route === null} bottomInset={bottomInset} />
        {focusId !== null ? <FlyToDestination destinations={destinations} focusId={focusId} /> : null}
        {interactive ? <ClickToSelect onSelect={onSelect ?? (() => {})} destinations={destinations} /> : null}
        {route?.geometry.coordinates.length ? (
          <Polyline
            positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: "#0284c7", weight: 6, opacity: 0.92, lineCap: "round", lineJoin: "round", ...(route.approximate ? { dashArray: "9 8" } : {}) }}
          />
        ) : null}
        {liveRoute?.geometry.coordinates.length ? (
          <Polyline
            positions={liveRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: "#0369a1", weight: 5, opacity: 0.98, lineCap: "round", lineJoin: "round", dashArray: "10 8" }}
          />
        ) : null}
        {routeStops.map((stop, index) => (
          <Marker key={`route-stop-${index}`} position={[stop.lat, stop.lng]} icon={numberedCircle(index + 1)}>
            <Popup closeButton={false} maxWidth={220} autoPan={false}>
              <p className="text-sm font-semibold text-lagoon-900">Stop {index + 1}: {stop.name}</p>
            </Popup>
          </Marker>
        ))}
        {livePosition ? (
          <>
            {livePosition.accuracy !== null ? <Circle center={[livePosition.lat, livePosition.lng]} radius={Math.min(livePosition.accuracy, 1000)} pathOptions={{ color: "#0284c7", fillColor: "#38bdf8", fillOpacity: 0.12, weight: 1 }} /> : null}
            <Marker position={[livePosition.lat, livePosition.lng]} icon={liveLocationIcon} zIndexOffset={1800}>
              <Popup closeButton={false} maxWidth={160} autoPan={false}><p className="text-sm font-semibold text-lagoon-900">Your location</p></Popup>
            </Marker>
          </>
        ) : null}
        {visibleDestinations.map((destination) => (
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
