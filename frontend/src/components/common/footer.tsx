import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white text-ink-600">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-semibold text-lagoon-900">Lakbai</p>
          <p className="mt-2 max-w-xs text-sm">
            From the sagas of Bantayan to the canyons of Badian — plan a Cebu trip on one map, with the budget in view.
          </p>
        </div>
        <nav className="space-y-2 text-sm" aria-label="Footer">
          <p className="font-semibold text-lagoon-900">Explore</p>
          <Link to="/" className="block transition-colors hover:text-sea-600">
            Find destinations
          </Link>
          <Link to="/app/trips" className="block transition-colors hover:text-sea-600">
            Build an itinerary
          </Link>
          <Link to="/about" className="block transition-colors hover:text-sea-600">
            About Lakbai
          </Link>
          <Link to="/contact" className="block transition-colors hover:text-sea-600">
            Contact
          </Link>
        </nav>
        <div className="text-sm">
          <p className="font-semibold text-lagoon-900">Practical</p>
          <p className="mt-2 max-w-xs text-ink-600">
            Costs are local estimates in Philippine pesos. Always confirm hours and fees before you travel.
          </p>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-ink-600">
        Lakbai — Manglakaw ta, Bai! Estimates only, not a booking service.
      </div>
    </footer>
  );
}
