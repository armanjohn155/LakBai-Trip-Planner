import { Link as RouterLink } from "react-router";

import { PinIcon } from "@/components/icons";
import { destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface TrendingDestinationCardProps {
  destination: Destination;
  onPress: (destination: Destination) => void;
}

function TrendingDestinationCard({ destination, onPress }: TrendingDestinationCardProps) {
  return (
    <RouterLink
      to={`/destinations/${destination.id}`}
      onClick={() => onPress(destination)}
      className="flex flex-col gap-2"
      replace
    >
      <div className="relative h-[13rem] w-[16rem] shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-lagoon-900 via-royal-800 to-royal-900 shadow-lg group">
        {destination.image_url ? (
          <img
            src={destination.image_url}
            alt={destination.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md ring-1 ring-inset ring-white/40">
          {formatMoney(destination.estimated_cost)}
        </span>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 pb-6">
          <span className="w-fit rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-sand-50 backdrop-blur-md ring-1 ring-inset ring-white/30">
            {destination.category}
          </span>
          <p className="line-clamp-1 text-sm font-bold leading-tight text-white">{destination.name}</p>
          <p className="flex items-center gap-1 text-xs font-medium text-sand-50/85">
            <PinIcon className="h-3 w-3" />
            {destinationLocation(destination)}
          </p>
        </div>
      </div>
    </RouterLink>
  );
}

interface TrendingDestinationsProps {
  destinations: Destination[];
  onSelect: (destination: Destination) => void;
  sectionTitle?: string;
  seeAllPath?: string;
}

export function TrendingDestinations({
  destinations,
  onSelect,
  sectionTitle = "Trending destinations",
  seeAllPath = "/destinations",
}: TrendingDestinationsProps) {
  const visible = destinations.slice(0, 6);

  return (
    <section className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="text-lg font-bold tracking-tight text-ink-900 sm:text-xl">
          {sectionTitle}
        </h2>
        <RouterLink
          to={seeAllPath}
          className="text-xs font-semibold text-sea-600 transition-colors hover:text-sea-500 sm:text-sm"
        >
          See all →
        </RouterLink>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:gap-4 sm:pb-0">
        {visible.map((destination) => (
          <TrendingDestinationCard
            key={destination.id}
            destination={destination}
            onPress={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
