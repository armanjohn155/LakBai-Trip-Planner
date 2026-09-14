import { DestinationCard } from "@/components/features/destinations/destination-card";
import { QuickFilters } from "@/components/features/destinations/quick-filters";
import { EmptyState } from "@/components/ui/feedback";
import type { Destination, DestinationFilters as Filters } from "@/lib/types";

interface CardDataSectionProps {
  destinations: Destination[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onSelect: (destination: Destination) => void;
}

export function CardDataSection({ destinations, filters, onFiltersChange, onSelect }: CardDataSectionProps) {
  return (
    <section id="destinations" className="scroll-mt-20 bg-sand-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <header className="mb-8 max-w-2xl">
          <h2 className="font-display text-3xl font-medium tracking-tight text-lagoon-900 sm:text-4xl">Find your spot</h2>
          <p className="mt-3 text-base leading-relaxed text-ink-600 sm:text-lg">
            Filter by region and category, then tap a card to plan it into your trip.
          </p>
        </header>

        <QuickFilters filters={filters} onChange={onFiltersChange} />

        {destinations.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="Nothing fits those filters" detail="Try clearing a filter or searching for a different place." />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} onClick={onSelect} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}