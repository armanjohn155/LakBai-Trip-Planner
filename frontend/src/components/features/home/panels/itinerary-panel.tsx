/**
 * "Itinerary" panel.
 *
 * Shows the real itinerary artwork: a trip list on the left beside a map of
 * the itinerary on the right.
 */
export function ItineraryPanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img
        src="/images/panels/itinerary.png"
        alt="A trip list on the left beside a map of the itinerary on the right"
        className="h-full w-full object-contain"
        width={1671}
        height={941}
        loading="lazy"
      />
    </div>
  );
}
