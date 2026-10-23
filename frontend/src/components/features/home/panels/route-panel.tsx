/**
 * "Route" panel.
 *
 * Shows the real route artwork: two phone screens side by side with a Cebu
 * trip plan. The first screen shows a route with stops and a Kawasan Falls
 * card; the second shows the optimized route with travel time and gas money
 * saved.
 */
export function RoutePanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img
        src="/images/panels/route.png"
        alt="Two phone screens of a Cebu trip planner. The first shows a route with stops and a Kawasan Falls card. The second shows the optimized route with 30 minutes of travel time and ₱1,500 of gas money saved."
        className="h-full w-full object-contain"
        width={1672}
        height={941}
        loading="lazy"
      />
    </div>
  );
}
