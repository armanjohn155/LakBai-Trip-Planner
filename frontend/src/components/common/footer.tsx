import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="bg-lagoon-950 text-sand-50/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-semibold text-sand-50">Suroy</p>
          <p className="mt-2 max-w-xs text-sm">
            From the sagas of Bantayan to the canyons of Badian — plan a Cebu trip on one map, with the budget in view.
          </p>
        </div>
        <nav className="space-y-2 text-sm" aria-label="Footer">
          <p className="font-semibold text-sand-50">Explore</p>
          <Link to="/" className="block hover:text-sand-50">
            Find destinations
          </Link>
          <Link to="/app/trips" className="block hover:text-sand-50">
            Build an itinerary
          </Link>
          <Link to="/about" className="block hover:text-sand-50">
            About Suroy
          </Link>
          <Link to="/contact" className="block hover:text-sand-50">
            Contact
          </Link>
        </nav>
        <div className="text-sm">
          <p className="font-semibold text-sand-50">Practical</p>
          <p className="mt-2 max-w-xs text-sand-50/60">
            Costs are local estimates in Philippine pesos. Always confirm hours and fees before you travel.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-sand-50/50">
        Suroy — a Cebu trip planner. Estimates only, not a booking service.
      </div>
    </footer>
  );
}