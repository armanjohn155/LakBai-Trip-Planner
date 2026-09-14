import { useEffect, useMemo, useState } from "react";

import { CarouselEdgeFade } from "@/components/ui/carousel-edge-fade";
import { categoryTone, DestinationGridCard } from "@/components/features/destinations/destination-explorer-card";
import { useCarouselScroll } from "@/hooks/use-carousel-scroll";
import { cn } from "@/lib/cn";
import type { Destination } from "@/lib/types";

const FEATURED_COUNT = 5;
const ROTATE_MS = 6000;
const POPULAR_COUNT = 8;

function rankByPopular(destinations: Destination[]): Destination[] {
  return [...destinations].sort((a, b) => {
    const reviews = (b.review_count ?? 0) - (a.review_count ?? 0);
    return reviews || (b.rating ?? 0) - (a.rating ?? 0);
  });
}

interface FeaturedDestinationsBannerProps {
  destinations: Destination[];
  onOpen: (destination: Destination) => void;
}

export function FeaturedDestinationsBanner({ destinations, onOpen }: FeaturedDestinationsBannerProps) {
  const featured = useMemo(() => rankByPopular(destinations).slice(0, FEATURED_COUNT), [destinations]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = featured.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  if (featured.length === 0) return null;

  return (
    <section
      aria-label="Featured destinations"
      className="relative -mt-8 h-[300px] w-screen overflow-hidden dropdown-shadow-xl bg-royal-900 sm:-mt-10 sm:h-[400px] ml-[calc(50%_-_50vw)] lg:h-[440px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {featured.map((destination, i) => {
        const active = i === index;
        return (
          <button
            key={destination.id}
            type="button"
            onClick={() => onOpen(destination)}
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
            className={cn(
              "absolute inset-0 h-full w-full text-left transition-opacity duration-700",
              active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <span
              className={cn("absolute inset-0 bg-gradient-to-br", categoryTone(destination.category))}
              aria-hidden="true"
            />
            {destination.image_url ? (
              <img
                src={destination.image_url}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <span
              className="absolute inset-0 bg-gradient-to-tr from-royal-950/95 via-royal-950/60 to-royal-950/15"
              aria-hidden="true"
            />
            <span className="absolute inset-0 flex h-full flex-col justify-end px-6 pb-12 sm:px-10 sm:pb-14">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-surf-300">Featured</span>
              <span className="mt-2 block max-w-2xl font-display text-3xl font-semibold leading-tight text-sand-50 sm:text-5xl">
                {destination.name}
              </span>
              <span className="mt-3 block max-w-xl line-clamp-2 text-sm leading-relaxed text-sand-50/85 sm:text-base">
                {destination.description}
              </span>
            </span>
          </button>
        );
      })}

      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2">
          {featured.map((destination, i) => (
            <button
              key={destination.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${destination.name}`}
              className={cn(
                "h-2 rounded-full bg-sand-50 transition-all duration-300",
                i === index ? "w-6 opacity-100" : "w-2 opacity-50 hover:opacity-80",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface PopularDestinationsCarouselProps {
  destinations: Destination[];
  isFavorited: (id: number) => boolean;
  onToggleFavorite: (destination: Destination) => void;
  onAdd: (destination: Destination) => void;
}

export function PopularDestinationsCarousel({
  destinations,
  isFavorited,
  onToggleFavorite,
  onAdd,
}: PopularDestinationsCarouselProps) {
  const popular = useMemo(() => rankByPopular(destinations).slice(0, POPULAR_COUNT), [destinations]);
  const { trackRef, canLeft, canRight, scrollBy } = useCarouselScroll<HTMLDivElement>();

  if (popular.length === 0) return null;

  return (
    <section aria-label="Popular destinations">
      <h2 className="font-display text-2xl font-medium text-lagoon-900 sm:text-3xl">Popular Destinations</h2>

      <div className="relative mt-5 -mx-4 sm:-mx-6">
        <div
          ref={trackRef}
          className="flex snap-x overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-5">
            {popular.map((destination) => (
              <div key={destination.id} data-card className="w-[15.5rem] shrink-0 sm:w-[19rem]">
                <DestinationGridCard
                  destination={destination}
                  favorited={isFavorited(destination.id)}
                  onToggleFavorite={() => onToggleFavorite(destination)}
                  onAdd={() => onAdd(destination)}
                />
              </div>
            ))}
          </div>
        </div>

        <CarouselEdgeFade side="left" hidden={!canLeft} onClick={() => scrollBy(-1)} />
        <CarouselEdgeFade side="right" hidden={!canRight} onClick={() => scrollBy(1)} />
      </div>
    </section>
  );
}