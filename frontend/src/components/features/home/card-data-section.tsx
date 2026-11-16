import { DestinationCard } from "@/components/features/destinations/destination-card";
import { QuickFilters } from "@/components/features/destinations/quick-filters";
import { EmptyState } from "@/components/ui/feedback";
import type { Destination, DestinationFilters as Filters } from "@/lib/types";

interface CardDataSectionProps {
  destinations: Destination[];
  total: number;
  categories: string[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onSelect: (destination: Destination) => void;
}

export function CardDataSection({ destinations, total, categories, filters, onFiltersChange, onSelect }: CardDataSectionProps) {
  return (
    <section id="destinations" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-20">
        <header className="mb-5 max-w-2xl sm:mb-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-lagoon-900 sm:text-4xl sm:font-medium">Popular destinations</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:mt-3 sm:text-lg">
            Filter by region and category, then tap a card to plan it into your trip.
          </p>
        </header>

        <QuickFilters filters={filters} categories={categories} onChange={onFiltersChange} />

        {destinations.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="Nothing fits those filters" detail="Try clearing a filter or searching for a different place." />
          </div>
        ) : (
          <>
            <p className="mt-4 text-xs font-medium text-ink-600 sm:mt-6 sm:text-sm">
              Showing {destinations.length} of {total} {total === 1 ? "place" : "places"}
            </p>
            <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:mt-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3" aria-label="Destination cards">
              {destinations.map((destination) => (
                <div key={destination.id} className="w-[68vw] max-w-[15rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
                  <DestinationCard destination={destination} onClick={onSelect} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
