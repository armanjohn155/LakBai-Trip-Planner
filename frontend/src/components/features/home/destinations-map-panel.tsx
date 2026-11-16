import { DestinationDetailPanel } from "@/components/features/destinations/destination-detail-panel";
import { destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { CebuMap } from "@/components/features/map/cebu-map";
import { CrosshairIcon, PinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useCurrentLocation } from "@/hooks/use-current-location";
import type { Destination } from "@/lib/types";

interface DestinationsMapPanelProps {
  destinations: Destination[];
  selected: Destination | null;
  onSelect: (destination: Destination) => void;
  loggedIn: boolean;
  onAddToTrip: (destination: Destination) => void;
  onSignUp: () => void;
  onClearSelected?: () => void;
}

export function DestinationsMapPanel({ destinations, selected, onSelect, loggedIn, onAddToTrip, onSignUp, onClearSelected }: DestinationsMapPanelProps) {
  const selectedAction = selected && (loggedIn ? (
    <Button className="w-full" onClick={() => onAddToTrip(selected)}>Add to an itinerary</Button>
  ) : (
    <Button className="w-full" onClick={onSignUp}>Sign up to add stops</Button>
  ));
  const { status, start, error: locationError } = useCurrentLocation();

  return (
    <section id="destinations-map" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-5 max-w-2xl sm:mb-8">
          <h2 className="font-display text-2xl font-medium tracking-tight text-lagoon-900 sm:text-4xl">Places on the map</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:mt-3 sm:text-lg">
            Tap a pin to preview its details — region, category, rough cost, and when to visit — without leaving the page.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch">
          <div className="relative h-[min(72svh,40rem)] min-h-[26rem] overflow-hidden rounded-[1.5rem] ring-1 ring-line sm:h-[560px] sm:rounded-3xl lg:h-[600px]">
            <CebuMap
              destinations={destinations}
              activeId={selected?.id}
              onSelect={onSelect}
              className="h-full w-full"
              zoomControlPosition="topright"
              bottomInset={selected ? 172 : 0}
            />
            <button
              type="button"
              onClick={() => start()}
              aria-label={status === "active" ? "Stop location tracking" : "Use my current location"}
              className={`absolute left-3 top-3 z-[600] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-sand-50 ${status === "active" ? "text-lagoon-900 bg-lagoon-100" : "text-ink-600"}`}
            >
              {status === "active" ? (
                <PinIcon className="h-5 w-5" />
              ) : (
                <CrosshairIcon className="h-5 w-5" />
              )}
            </button>
            {locationError ? (
              <div className="absolute right-3 top-3 z-[600] rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-md ring-1 ring-inset ring-rose-100">
                {locationError}
              </div>
            ) : null}
            {selected ? (
              <div className="absolute inset-x-3 bottom-3 z-[500] lg:hidden">
                <MobileDestinationCard
                  destination={selected}
                  action={selectedAction}
                  onClose={onClearSelected}
                />
              </div>
            ) : null}
          </div>

          <div className="relative hidden lg:block">
            <div aria-hidden="true" className="glass-blob" />
            {selected ? (
              <DestinationDetailPanel
                destination={selected}
                action={selectedAction}
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

function MobileDestinationCard({ destination, action, onClose }: { destination: Destination; action: React.ReactNode; onClose?: () => void }) {
  return (
    <article className="rounded-2xl border border-white/80 bg-white/95 p-3 shadow-[0_12px_35px_rgba(3,33,31,0.2)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        {destination.image_url ? (
          <img src={destination.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <div aria-hidden="true" className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-surf-400 to-sea-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-lagoon-950">{destination.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-600">{destinationLocation(destination)} · {destination.category}</p>
          <p className="mt-1 text-xs font-semibold text-lagoon-800">{formatMoney(destination.estimated_cost)} <span className="font-normal text-ink-600">estimated per visit</span></p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close destination details" className="-mt-7 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-100 text-ink-700 hover:bg-sand-200">
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        ) : null}
      </div>
      <div className="mt-2.5">{action}</div>
    </article>
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
