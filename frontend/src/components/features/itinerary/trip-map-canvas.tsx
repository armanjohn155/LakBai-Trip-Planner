import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";

import { createNumberedPin, createPinIcon, dayColor } from "@/components/features/map/map-pin";
import { formatMoney } from "@/lib/format";
import { formatTimeRange } from "@/components/features/itinerary/itinerary-constants";
import type { Destination, ItineraryItem } from "@/lib/types";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

export interface LiveMapPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export interface LiveMapPoint {
  lat: number;
  lng: number;
}

export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface TripMapCanvasProps {
  items: ItineraryItem[];
  activeItemId?: number | null;
  hoveredItemId?: number | null;
  onSelectItem?: (item: ItineraryItem) => void;
  onHoverItem?: (id: number | null) => void;
  focusPoint?: [number, number] | null;
  focusNonce?: number;
  pickMode?: boolean;
  pickedPoint?: { lat: number; lng: number } | null;
  onPickPoint?: (lat: number, lng: number) => void;
  destinationMarkers?: Destination[];
  activeDestinationId?: number | null;
  hoveredDestinationId?: number | null;
  onSelectDestination?: (destination: Destination) => void;
  onHoverDestination?: (id: number | null) => void;
  onAddDestination?: (destination: Destination) => void;
  insets: MapInsets;
  fitKey?: string | number;
  bottomInset?: number;
  rightInset?: number;
  interactive?: boolean;
  className?: string;
  livePosition?: LiveMapPosition | null;
  traveledPath?: LiveMapPoint[];
  nextStopPoint?: [number, number] | null;
  following?: boolean;
}

function FitToStops({ points, insets, fitKey }: { points: [number, number][]; insets: MapInsets; fitKey?: string | number }) {
  const map = useMap();
  const pointKey = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("|");

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      map.invalidateSize();
      const paddingTopLeft: L.PointExpression = [insets.left, insets.top];
      const paddingBottomRight: L.PointExpression = [insets.right, insets.bottom];

      if (points.length === 0) {
        // A small box around Cebu lets the panel padding shift the empty state too.
        map.fitBounds(L.latLngBounds(CEBU_CENTER, CEBU_CENTER).pad(0.35), {
          paddingTopLeft,
          paddingBottomRight,
          maxZoom: 10,
          animate: false,
        });
        return;
      }

      if (points.length === 1) {
        map.fitBounds(L.latLngBounds(points[0], points[0]).pad(0.08), {
          paddingTopLeft,
          paddingBottomRight,
          maxZoom: 15,
          animate: false,
        });
        return;
      }

      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft,
        paddingBottomRight,
        maxZoom: 15,
        animate: false,
      });
    };

    // Run once immediately after paint and again after the floating panel settles.
    const frame = window.requestAnimationFrame(run);
    const timer = window.setTimeout(run, 260);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pointKey, insets.left, insets.top, insets.right, insets.bottom, fitKey, map, points]);

  return null;
}

function ResizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function PanToFocus({ point, nonce, insets }: { point: [number, number] | null; nonce: number; insets: MapInsets }) {
  const map = useMap();

  useEffect(() => {
    if (!point) return;
    const zoom = Math.max(map.getZoom(), 13);
    // Shift the centre so the focused pin lands in the middle of the map
    // area that is not covered by the floating panel and overlays.
    const projected = map
      .project(point, zoom)
      .subtract(L.point((insets.left - insets.right) / 2, (insets.top - insets.bottom) / 2));
    map.flyTo(map.unproject(projected, zoom), zoom, { duration: 0.5 });
    // The nonce intentionally drives this effect; panning should not repeat on panel re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return null;
}

function ClickToPick({ onPickPoint }: { onPickPoint: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPickPoint(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FollowPosition({ point, following }: { point: [number, number] | null; following: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!point || !following) return;
    map.panTo(point, { animate: true, duration: 0.6 });
  }, [point, following, map]);

  return null;
}

export function TripMapCanvas({
  items,
  activeItemId = null,
  hoveredItemId = null,
  onSelectItem,
  onHoverItem,
  focusPoint = null,
  focusNonce = 0,
  pickMode = false,
  pickedPoint = null,
  onPickPoint,
  destinationMarkers = [],
  activeDestinationId = null,
  hoveredDestinationId = null,
  onSelectDestination,
  onHoverDestination,
  onAddDestination,
  insets,
  fitKey,
  bottomInset = 0,
  rightInset = 0,
  interactive = true,
  className,
  livePosition = null,
  traveledPath = [],
  nextStopPoint = null,
  following = false,
}: TripMapCanvasProps) {
  const located = useMemo(() => items.filter((item) => item.latitude !== null && item.longitude !== null), [items]);
  const points = useMemo(
    () => located.map((item) => [Number(item.latitude), Number(item.longitude)] as [number, number]),
    [located],
  );

  const ordered = useMemo(
    () => [...items].sort((a, b) => a.day_number - b.day_number || a.order - b.order),
    [items],
  );
  const sequence = useMemo(() => {
    const map = new Map<number, number>();
    ordered.forEach((item, index) => map.set(item.id, index + 1));
    return map;
  }, [ordered]);

  const paths = useMemo(() => {
    const days = [...new Set(located.map((item) => item.day_number))].sort((a, b) => a - b);
    return days
      .map((day) => ({
        day,
        points: located
          .filter((item) => item.day_number === day)
          .map((item) => [Number(item.latitude), Number(item.longitude)] as [number, number]),
      }))
      .filter((path) => path.points.length > 1);
  }, [located]);

  const livePoint = useMemo<[number, number] | null>(
    () => (livePosition ? [livePosition.lat, livePosition.lng] : null),
    [livePosition],
  );
  const traveledPositions = useMemo(
    () => traveledPath.map((point) => [point.lat, point.lng] as [number, number]),
    [traveledPath],
  );
  const liveIcon = useMemo(
    () =>
      L.divIcon({
        className: "trip-live-marker",
        html: '<span class="trip-live-marker__pulse"></span><span class="trip-live-marker__dot"></span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    [],
  );

  const style = {
    "--trip-map-bottom": `${bottomInset}px`,
    "--trip-map-right": `${rightInset}px`,
  } as CSSProperties;

  return (
    <div
      className={["trip-map-canvas absolute inset-0", pickMode && "trip-map-pick", className].filter(Boolean).join(" ")}
      style={style}
    >
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

        <FitToStops points={points} insets={insets} fitKey={fitKey} />
        <ResizeWatcher />
        <PanToFocus point={focusPoint} nonce={focusNonce} insets={insets} />
        <FollowPosition point={livePoint} following={following} />
        {pickMode && onPickPoint ? <ClickToPick onPickPoint={onPickPoint} /> : null}
        <ZoomControl position="bottomright" />

        {paths.map((path) => (
          <Polyline
            key={`day-${path.day}`}
            positions={path.points}
            pathOptions={{ color: dayColor(path.day), weight: 4, opacity: 0.8, dashArray: "7 9" }}
          />
        ))}

        {livePoint && livePosition?.accuracy != null && livePosition.accuracy > 0 ? (
          <Circle
            center={livePoint}
            radius={Math.max(livePosition.accuracy, 5)}
            pathOptions={{ color: "#0284c7", weight: 1, opacity: 0.5, fillColor: "#38bdf8", fillOpacity: 0.1 }}
          />
        ) : null}

        {traveledPositions.length > 1 ? (
          <>
            <Polyline positions={traveledPositions} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.85 }} />
            <Polyline
              positions={traveledPositions}
              pathOptions={{ color: "#0369a1", weight: 4, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
            />
          </>
        ) : null}

        {livePoint && nextStopPoint ? (
          <Polyline
            positions={[livePoint, nextStopPoint]}
            pathOptions={{ color: "#0f766e", weight: 3, opacity: 0.8, dashArray: "2 9" }}
          />
        ) : null}

        {located.map((item) => {
          const label = sequence.get(item.id) ?? item.order;
          const highlighted = item.id === activeItemId || item.id === hoveredItemId;
          const icon = createNumberedPin(label, dayColor(item.day_number), highlighted);
          const time = formatTimeRange(item.start_time, item.duration_minutes);

          return (
            <Marker
              key={item.id}
              position={[Number(item.latitude), Number(item.longitude)]}
              icon={icon}
              zIndexOffset={highlighted ? 1000 : 0}
              eventHandlers={{
                click: () => onSelectItem?.(item),
                mouseover: () => onHoverItem?.(item.id),
                mouseout: () => onHoverItem?.(null),
              }}
            >
              <Popup closeButton={false} maxWidth={230} autoPan={false}>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-lagoon-900">{item.title}</p>
                  <p className="text-xs text-ink-600">
                    Day {item.day_number}
                    {time ? ` · ${time}` : ""}
                  </p>
                  {item.estimated_budget != null ? (
                    <p className="text-xs font-semibold text-sea-600">{formatMoney(item.estimated_budget)}</p>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {destinationMarkers.map((destination) => {
          const handleAdd = onAddDestination ?? onSelectDestination;
          const highlighted = destination.id === activeDestinationId || destination.id === hoveredDestinationId;
          return (
            <Marker
              key={`destination-${destination.id}`}
              position={[Number(destination.latitude), Number(destination.longitude)]}
              icon={createPinIcon(highlighted)}
              zIndexOffset={highlighted ? 900 : -200}
              eventHandlers={{
                click: () => onSelectDestination?.(destination),
                mouseover: () => onHoverDestination?.(destination.id),
                mouseout: () => onHoverDestination?.(null),
              }}
            >
              <Popup closeButton={false} maxWidth={240} autoPan={false}>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-lagoon-900">{destination.name}</p>
                  <p className="text-xs text-ink-600">
                    {destination.category}
                    {destination.municipality ? ` · ${destination.municipality}` : ""}
                  </p>
                  <p className="text-xs font-semibold text-sea-600">{formatMoney(destination.estimated_cost)}</p>
                  {handleAdd ? (
                    <button
                      type="button"
                      onClick={() => handleAdd(destination)}
                      className="rounded-full bg-surf-400 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-surf-300"
                    >
                      Add to trip
                    </button>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {livePoint ? (
          <Marker position={livePoint} icon={liveIcon} zIndexOffset={2000} interactive={false} />
        ) : null}

        {pickedPoint ? (
          <Marker
            position={[pickedPoint.lat, pickedPoint.lng]}
            icon={createPinIcon(true)}
            zIndexOffset={1200}
            draggable={interactive}
            eventHandlers={{
              dragend: (event) => {
                const point = (event.target as L.Marker).getLatLng();
                onPickPoint?.(point.lat, point.lng);
              },
            }}
          >
            <Popup closeButton={false} maxWidth={200} autoPan={false}>
              <p className="text-xs text-ink-600">Drag to fine-tune, or click the map to move this pin.</p>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
