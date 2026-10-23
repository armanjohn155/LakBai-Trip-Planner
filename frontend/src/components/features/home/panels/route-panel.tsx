/**
 * "Route" panel.
 *
 * Placeholder for now. Swap the <img> for the two phone mockups when they're
 * ready — the carousel only cares that the root element fills the panel card.
 */
export function RoutePanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* TODO: use /images/panels/route.png once the real artwork exists. */}
      <img
        src="/images/trip-placeholder.svg"
        alt="Preview of two phone mockups side by side, each showing a route on a map"
        className="h-full w-full rounded-2xl object-contain"
        loading="lazy"
      />
    </div>
  );
}
