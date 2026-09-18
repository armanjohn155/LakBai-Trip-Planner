import { DestinationDetailPanel } from "@/components/features/destinations/destination-detail-panel";
import { CebuMap } from "@/components/features/map/cebu-map";
import { Button } from "@/components/ui/button";
import type { Destination } from "@/lib/types";

interface DestinationsMapPanelProps {
  destinations: Destination[];
  selected: Destination | null;
  onSelect: (destination: Destination) => void;
  loggedIn: boolean;
  onAddToTrip: (destination: Destination) => void;
  onSignUp: () => void;
}

export function DestinationsMapPanel({ destinations, selected, onSelect, loggedIn, onAddToTrip, onSignUp }: DestinationsMapPanelProps) {
  return (
    <section id="destinations-map" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-8 max-w-2xl">
          <h2 className="font-display text-3xl font-medium tracking-tight text-lagoon-900 sm:text-4xl">Places on the map</h2>
          <p className="mt-3 text-base leading-relaxed text-ink-600 sm:text-lg">
            Tap a pin to preview its details — region, category, rough cost, and when to visit — without leaving the page.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch">
          <div className="h-[420px] overflow-hidden rounded-3xl ring-1 ring-line sm:h-[520px] lg:h-[560px]">
            <CebuMap destinations={destinations} activeId={selected?.id} onSelect={onSelect} className="h-full w-full" />
          </div>

          <div className="relative">
            <div aria-hidden="true" className="glass-blob" />
            {selected ? (
              <DestinationDetailPanel
                destination={selected}
                action={
                  loggedIn ? (
                    <Button className="w-full" onClick={() => onAddToTrip(selected)}>
                      Add to an itinerary
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={onSignUp}>
                      Sign up to add stops
                    </Button>
                  )
                }
              />
            ) : (
              <PanelPlaceholder />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PanelPlaceholder() {
  return (
    <div className="glass-frost flex h-full min-h-[280px] items-center justify-center rounded-3xl p-8 text-center">
      <div className="max-w-xs">
        <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8 text-surf-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.1 7-11a7 7 0 10-14 0c0 5.9 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
        <p className="mt-4 font-display text-2xl font-medium text-lagoon-900">Pick a destination</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Tap a pin on the map to preview its cost, category, and the best time to visit.
        </p>
      </div>
    </div>
  );
}