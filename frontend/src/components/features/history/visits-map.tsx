import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { activePin, defaultPin } from "@/components/features/map/map-pin";
import type { VisitedMapPlace } from "@/lib/types";

const CEBU_CENTER: [number, number] = [10.2, 123.6];

interface VisitsMapProps {
  places: VisitedMapPlace[];
  className?: string;
}

/**
 * A read-only map of everywhere the user has visited. Verified destinations
 * get the highlighted pin; manual ones use the standard pin.
 */
export function VisitsMap({ places, className }: VisitsMapProps) {
  return (
    <MapContainer
      center={CEBU_CENTER}
      zoom={9}
      className={className}
      scrollWheelZoom={false}
      attributionControl={false}
      zoomControl
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {places.map((place) => (
        <Marker
          key={place.destination_id}
          position={[Number(place.latitude), Number(place.longitude)]}
          icon={place.verified ? activePin : defaultPin}
          title={place.name}
        >
          <Popup closeButton={false} maxWidth={240} autoPan={false}>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-lagoon-900">{place.name}</p>
              <p className="text-xs text-ink-600">
                {place.visit_count} {place.visit_count === 1 ? "visit" : "visits"}
                {place.verified ? " · verified" : " · manual"}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
