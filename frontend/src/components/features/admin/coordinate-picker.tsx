import { useEffect } from "react";

import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { activePin } from "@/components/features/map/map-pin";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

interface CoordinatePickerProps {
  latitude: string;
  longitude: string;
  onChange: (latitude: number, longitude: number) => void;
  className?: string;
}

function ClickToPick({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    map.setView(position, Math.max(map.getZoom(), 11), { animate: true });
  }, [map, position]);

  return null;
}

export function CoordinatePicker({ latitude, longitude, onChange, className }: CoordinatePickerProps) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPosition = Number.isFinite(lat) && Number.isFinite(lng) && latitude !== "" && longitude !== "";
  const position: [number, number] | null = hasPosition ? [lat, lng] : null;

  return (
    <div className={className}>
      <div className="h-64 overflow-hidden rounded-xl ring-1 ring-inset ring-line">
        <MapContainer center={position ?? CEBU_CENTER} zoom={position ? 11 : 9} scrollWheelZoom className="h-full w-full">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickToPick onChange={onChange} />
          <Recenter position={position} />
          {position ? <Marker position={position} icon={activePin} /> : null}
        </MapContainer>
      </div>
      <p className="mt-1.5 text-xs text-ink-600">Click the map to set the exact coordinates.</p>
    </div>
  );
}
