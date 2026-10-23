/**
 * "View map" panel.
 *
 * Placeholder for now. Swap the <img> for the real map + "Map layers" and
 * "Itinerary" legend cards when they're ready — the carousel only cares that
 * the root element fills the panel card.
 */
export function MapPanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* TODO: use /images/panels/view-map.png once the real artwork exists. */}
      <img
        src="/images/trip-placeholder.svg"
        alt="Preview of the map view with a Map layers card on the left and an itinerary legend on the right"
        className="h-full w-full rounded-2xl object-contain"
        loading="lazy"
      />
    </div>
  );
}
