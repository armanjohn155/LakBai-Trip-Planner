import { Link } from "react-router";

import { CarouselEdgeFade } from "@/components/ui/carousel-edge-fade";
import { categoryTag, categoryTone, destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { PinIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { useCarouselScroll } from "@/hooks/use-carousel-scroll";
import type { NearbyDestination } from "@/lib/geo";

interface NearbyDestinationsProps {
  nearby: NearbyDestination[];
}

export function NearbyDestinations({ nearby }: NearbyDestinationsProps) {
  const { trackRef, canLeft, canRight, scrollBy } = useCarouselScroll<HTMLDivElement>();

  return (
    <div className="relative -mx-4 sm:-mx-6">
      <div
        ref={trackRef}
        className="flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {nearby.map(({ destination, distanceKm }) => (
          <Link
            key={destination.id}
            to={`/destinations/${destination.id}`}
            data-card
            className="glass group w-56 shrink-0 snap-start overflow-hidden rounded-2xl transition-shadow hover:shadow-md"
          >
          <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
            {destination.image_url ? (
              <img
                src={destination.image_url}
                alt={destination.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <div className={cn("h-full w-full bg-gradient-to-br", categoryTone(destination.category))} aria-hidden="true" />
            <Badge className="absolute bottom-2 left-2 bg-lagoon-950/80 text-sand-50 backdrop-blur-sm" tone="neutral">
              {categoryTag(destination.category)}
            </Badge>
          </div>
          <div className="p-3">
            <h4 className="truncate font-display text-base font-semibold leading-tight text-lagoon-900">{destination.name}</h4>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-sea-600">
              <PinIcon className="h-3 w-3" />
              {destinationLocation(destination)}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-ink-600">{distanceKm.toFixed(1)} km away</p>
          </div>
        </Link>
      ))}
      </div>

      <CarouselEdgeFade side="left" hidden={!canLeft} onClick={() => scrollBy(-1)} />
      <CarouselEdgeFade side="right" hidden={!canRight} onClick={() => scrollBy(1)} />
    </div>
  );
}