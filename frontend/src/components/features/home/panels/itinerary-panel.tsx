/**
 * "Itinerary" panel.
 *
 * Placeholder for now. Swap the <img> for the real trip list + map layout when
 * it's ready — the carousel only cares that the root element fills the panel
 * card.
 */
export function ItineraryPanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* TODO: use /images/panels/itinerary.png once the real artwork exists. */}
      <img
        src="/images/trip-placeholder.svg"
        alt="Preview of a trip list on the left beside a map of the itinerary on the right"
        className="h-full w-full rounded-2xl object-contain"
        loading="lazy"
      />
    </div>
  );
}
