/**
 * "View map" panel.
 *
 * Shows the real map artwork: a map with a "Map layers" card on the left and
 * an "Itinerary" legend card on the right.
 */
export function MapPanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img
        src="/images/panels/map.png"
        alt="Map view with a Map layers card on the left and an Itinerary legend card on the right"
        className="h-full w-full object-contain"
        width={1514}
        height={1039}
        loading="lazy"
      />
    </div>
  );
}
