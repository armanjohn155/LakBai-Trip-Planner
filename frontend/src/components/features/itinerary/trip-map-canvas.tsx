import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";

import { createMemberPin, createNumberedPin, createPinIcon, dayColor, meetupPin, memberColor, nextStopPin } from "@/components/features/map/map-pin";
import { formatMoney, relativeTime } from "@/lib/format";
import { formatTimeRange } from "@/components/features/itinerary/itinerary-constants";
import type { Destination, GroupTrackingMeetup, GroupTrackingMember, ItineraryItem, RouteGeometryResponse } from "@/lib/types";
import type { PlannedRoadRoute } from "@/hooks/use-route";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

export interface LiveMapPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading?: number | null;
  speed?: number | null;
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
  fitLiveKey?: number;
  bottomInset?: number;
  rightInset?: number;
  interactive?: boolean;
  className?: string;
  livePosition?: LiveMapPosition | null;
  traveledPath?: LiveMapPoint[];
  nextStopPoint?: [number, number] | null;
  liveRoute?: RouteGeometryResponse | null;
  plannedRoutes?: PlannedRoadRoute[];
  following?: boolean;
  onManualPan?: () => void;
  partyMembers?: GroupTrackingMember[];
  meetup?: GroupTrackingMeetup | null;
}

function FitToStops({ points, insets, fitKey, suppressFit, following, roadGeometryReady }: { points: [number, number][]; insets: MapInsets; fitKey?: string | number; suppressFit: boolean; following: boolean; roadGeometryReady: boolean }) {
  const map = useMap();
  const firstRouteFit = useRef(false);
  const pointKey = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("|");

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      if (suppressFit) return;
      if (firstRouteFit.current && !following) return;
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
        if (roadGeometryReady) firstRouteFit.current = true;
        return;
      }

      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft,
        paddingBottomRight,
        maxZoom: 15,
        animate: false,
      });
      if (roadGeometryReady) firstRouteFit.current = true;
    };

    // Run once immediately after paint and again after the floating panel settles.
    const frame = window.requestAnimationFrame(run);
    const timer = window.setTimeout(run, 260);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pointKey, insets.left, insets.top, insets.right, insets.bottom, fitKey, map, points, suppressFit, following, roadGeometryReady]);

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

function FollowPosition({ point, following, insets }: { point: [number, number] | null; following: boolean; insets: MapInsets }) {
  const map = useMap();

  useEffect(() => {
    if (!point || !following) return;
    const zoom = map.getZoom();
    const projected = map.project(point, zoom).subtract(L.point((insets.left - insets.right) / 2, (insets.top - insets.bottom) / 2));
    map.panTo(map.unproject(projected, zoom), { animate: true, duration: 0.6 });
  }, [point, following, insets.bottom, insets.left, insets.right, insets.top, map]);

  return null;
}

function FitToLiveBounds({ point, destination, route, following, insets, fitKey }: { point: [number, number] | null; destination: [number, number] | null; route: [number, number][]; following: boolean; insets: MapInsets; fitKey: number }) {
  const map = useMap();
  const firstFit = useRef(false);
  const latest = useRef({ point, destination, route, insets, following });
  useEffect(() => {
    latest.current = { point, destination, route, insets, following };
  }, [destination, insets, point, route, following]);
  useEffect(() => {
    const current = latest.current;
    if (fitKey === 0 || current.point === null || current.route.length < 2) return;
    if (firstFit.current && !current.following) return;
    firstFit.current = true;
    const bounds = L.latLngBounds(current.route);
    map.fitBounds(bounds.pad(current.destination ? 0.15 : 0.08), {
      paddingTopLeft: [current.insets.left, current.insets.top],
      paddingBottomRight: [current.insets.right, current.insets.bottom],
      maxZoom: 15,
      animate: true,
    });
  }, [fitKey, map, route, following]);
  return null;
}

function ManualPanListener({ onManualPan }: { onManualPan?: () => void }) {
  useMapEvents({
    dragstart(event) {
      if ("originalEvent" in event) onManualPan?.();
    },
  });
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
  fitLiveKey = 0,
  bottomInset = 0,
  rightInset = 0,
  interactive = true,
  className,
  livePosition = null,
  traveledPath = [],
  nextStopPoint = null,
  liveRoute = null,
  plannedRoutes = [],
  following = false,
  onManualPan,
  partyMembers = [],
  meetup = null,
}: TripMapCanvasProps) {
  const located = useMemo(() => items.filter((item) => item.latitude !== null && item.longitude !== null), [items]);
  const points = useMemo(
    () => located.map((item) => [Number(item.latitude), Number(item.longitude)] as [number, number]),
    [located],
  );
  const plannedGeometryPoints = useMemo(
    () => plannedRoutes.flatMap((path) => path.coordinates),
    [plannedRoutes],
  );
  const fitPoints = plannedGeometryPoints.length > 1 ? plannedGeometryPoints : points;

  const ordered = useMemo(
    () => [...items].sort((a, b) => a.day_number - b.day_number || a.order - b.order),
    [items],
  );
  const sequence = useMemo(() => {
    const map = new Map<number, number>();
    ordered.forEach((item, index) => map.set(item.id, index + 1));
    return map;
  }, [ordered]);

  const livePoint = useMemo<[number, number] | null>(
    () => (livePosition ? [livePosition.lat, livePosition.lng] : null),
    [livePosition],
  );
  const traveledPositions = useMemo(
    () => traveledPath.map((point) => [point.lat, point.lng] as [number, number]),
    [traveledPath],
  );
  const liveRoutePositions = useMemo(() => {
    const coordinates = liveRoute?.geometry.coordinates ?? [];
    const points = coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (livePoint === null || points.length < 2) return points;
    let closest = { distance: Number.POSITIVE_INFINITY, index: 0, point: points[0] };
    const scale = Math.cos(livePoint[0] * Math.PI / 180) * 111_000;
    const xy = (point: [number, number]) => [point[1] * scale, point[0] * 111_000] as const;
    const user = xy(livePoint);
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = xy(points[index]); const b = xy(points[index + 1]);
      const dx = b[0] - a[0]; const dy = b[1] - a[1];
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((user[0] - a[0]) * dx + (user[1] - a[1]) * dy) / length));
      const projected: [number, number] = [points[index][0] + (points[index + 1][0] - points[index][0]) * t, points[index][1] + (points[index + 1][1] - points[index][1]) * t];
      const distance = Math.hypot(user[0] - (a[0] + dx * t), user[1] - (a[1] + dy * t));
      if (distance < closest.distance) closest = { distance, index, point: projected };
    }
    return [closest.point, ...points.slice(closest.index + 1)];
  }, [liveRoute, livePoint]);
  const heading = livePosition?.heading ?? null;
  const speed = livePosition?.speed ?? null;
  const liveIcon = useMemo(
    () =>
      L.divIcon({
        className: "trip-live-marker",
        html: `<span class="trip-live-marker__pulse"></span>${speed != null && speed > 1 && heading != null ? `<span class="trip-live-marker__arrow" style="transform:rotate(${heading}deg)">↑</span>` : '<span class="trip-live-marker__dot"></span>'}`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [heading, speed],
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

        <FitToStops points={fitPoints} insets={insets} fitKey={fitKey} suppressFit={livePoint !== null} following={following} roadGeometryReady={plannedGeometryPoints.length > 1} />
        <ResizeWatcher />
        <PanToFocus point={focusPoint} nonce={focusNonce} insets={insets} />
        <FollowPosition point={livePoint} following={following} insets={insets} />
        <FitToLiveBounds point={livePoint} destination={nextStopPoint} route={liveRoutePositions} following={following} insets={insets} fitKey={fitLiveKey} />
        <ManualPanListener onManualPan={onManualPan} />
        {pickMode && onPickPoint ? <ClickToPick onPickPoint={onPickPoint} /> : null}
        <ZoomControl position="bottomright" />

        {plannedRoutes.map((path) => (
          <Polyline key={`day-${path.day}`} positions={path.coordinates} pathOptions={{ color: dayColor(path.day), weight: 3, opacity: 0.72, ...(path.approximate ? { dashArray: "7 9" } : {}) }}>
            {path.approximate ? <Tooltip sticky>Approx. (no road route)</Tooltip> : null}
          </Polyline>
        ))}

        {livePoint && livePosition?.accuracy != null && livePosition.accuracy > 0 && livePosition.accuracy <= 200 ? (
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

        {liveRoutePositions.length > 1 ? (
          <>
            {liveRoute?.approximate ? null : <Polyline positions={liveRoutePositions} pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />}
            <Polyline positions={liveRoutePositions} pathOptions={{ color: "#0284c7", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round", ...(liveRoute?.approximate ? { dashArray: "8 8" } : {}) }}>
              {liveRoute?.approximate ? <Tooltip sticky>Approx. (no road route)</Tooltip> : null}
            </Polyline>
          </>
        ) : null}

        {livePoint && nextStopPoint ? <Marker position={nextStopPoint} icon={nextStopPin} zIndexOffset={1800} /> : null}

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

        {partyMembers.map((member) =>
          member.position ? (
            <Marker
              key={`party-${member.user_id}`}
              position={[member.position.lat, member.position.lng]}
              icon={createMemberPin({
                name: member.name,
                color: memberColor(member.user_id),
                avatarUrl: member.avatar_url,
                stale: member.online === false,
              })}
              zIndexOffset={1500}
            >
              <Popup closeButton={false} maxWidth={220} autoPan={false}>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-lagoon-900">{member.name}</p>
                  <p className="text-xs text-ink-600">
                    {member.online
                      ? `Sharing now${member.last_seen_at ? ` · ${relativeTime(member.last_seen_at)}` : ""}`
                      : `Last seen ${relativeTime(member.last_seen_at)} (stale)`}
                  </p>
                  {member.arrived_stop ? (
                    <p className="text-xs font-medium text-sea-600">✓ At {member.arrived_stop.title}</p>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          ) : null,
        )}

        {meetup ? (
          <Marker position={[meetup.lat, meetup.lng]} icon={meetupPin} zIndexOffset={1400}>
            <Popup closeButton={false} maxWidth={220} autoPan={false}>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-lagoon-900">
                  {meetup.note?.trim() ? meetup.note : "Meet here"}
                </p>
                <p className="text-xs text-ink-600">
                  Pinned by {meetup.created_by_name ?? "a traveller"}
                </p>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {livePoint ? (
          <Marker position={livePoint} icon={liveIcon} zIndexOffset={2000}>
            <Tooltip direction="top" offset={[0, -12]}>You are here</Tooltip>
          </Marker>
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
