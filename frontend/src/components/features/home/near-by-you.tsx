import { Link as RouterLink } from "react-router";

import { PinIcon } from "@/components/icons";
import { destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

function NearByCard({ destination, onPress }: { destination: Destination; onPress: (d: Destination) => void }) {
  return (
    <RouterLink
      to={`/destinations/${destination.id}`}
      onClick={() => onPress(destination)}
      className="flex items-center gap-3 rounded-xl bg-white/90 p-3 border border-line hover:bg-sand-50 transition-colors"
      replace
    >
      <div className="relative shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-gradient-to-br from-lagoon-900 via-royal-800 to-royal-900 shadow-md">
        {destination.image_url ? (
          <img
            src={destination.image_url}
            alt={destination.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <span className="absolute right-1 top-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md ring-1 ring-inset ring-white/40">
          {formatMoney(destination.estimated_cost)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{destination.name}</p>
        <p className="flex items-center gap-1 text-xs text-ink-500">
          <PinIcon className="h-3 w-3" />
          {destinationLocation(destination)}
        </p>
      </div>
    </RouterLink>
  );
}

interface NearByYouProps {
  destinations: Destination[];
  onSelect: (destination: Destination) => void;
  sectionTitle?: string;
  seeAllPath?: string;
}

export function NearByYou({
  destinations,
  onSelect,
  sectionTitle = "Near by you",
  seeAllPath = "/destinations",
}: NearByYouProps) {
  const visible = destinations.slice(0, 4);

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((destination) => (
          <NearByCard key={destination.id} destination={destination} onPress={onSelect} />
        ))}
        {visible.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-ink-600">No nearby destinations yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
