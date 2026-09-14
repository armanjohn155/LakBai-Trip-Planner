/* eslint-disable react-refresh/only-export-components */

import type { Ref } from "react";

import { Link } from "react-router";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeartIcon, PinIcon, PlusIcon, StarIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatCompactNumber, formatMoney, toNumber } from "@/lib/format";
import type { Destination } from "@/lib/types";

const CATEGORY_TAGS: Record<string, string> = {
  Beach: "Beach",
  Waterfall: "Waterfall",
  Islands: "Island",
  "Mountains & Hiking": "Mountain",
  "Historical & Cultural": "Historical",
  "Religious Sites": "Religious",
  "Food & Restaurants": "Food",
  "Diving & Water Activities": "Diving",
  "Nature & Eco-Tourism": "Nature",
};

const categoryTones: Record<string, string> = {
  Beach: "from-sea-500 to-sea-600",
  Waterfall: "from-lagoon-800 to-lagoon-900",
  Islands: "from-surf-400 to-sea-500",
  "Mountains & Hiking": "from-lagoon-700 to-lagoon-900",
  "Historical & Cultural": "from-ink-800 to-ink-900",
  "Religious Sites": "from-lagoon-600 to-lagoon-800",
  "Food & Restaurants": "from-mango-400 to-mango-500",
  "Diving & Water Activities": "from-sea-600 to-lagoon-800",
  "Nature & Eco-Tourism": "from-sea-500 to-lagoon-700",
};

const defaultTone = "from-lagoon-700 to-lagoon-900";

export function categoryTag(category: string): string {
  return CATEGORY_TAGS[category] ?? category;
}

export function categoryTone(category: string): string {
  return categoryTones[category] ?? defaultTone;
}

export function destinationLocation(destination: Destination): string {
  const place = destination.municipality ?? destination.region;
  return place === "Cebu City" || place === "Lapu-Lapu City" ? place : `${place}, Cebu`;
}

function CoverImage({ destination }: { destination: Destination }) {
  if (destination.image_url) {
    return (
      <img
        src={destination.image_url}
        alt={destination.name}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return <div className={cn("h-full w-full bg-gradient-to-br", categoryTone(destination.category))} aria-hidden="true" />;
}

function CoverBadge({ destination }: { destination: Destination }) {
  return (
    <span className="absolute bottom-3 left-3 rounded-full bg-lagoon-950/80 px-2.5 py-1 text-xs font-semibold text-sand-50 backdrop-blur-sm">
      {categoryTag(destination.category)}
    </span>
  );
}

function FavoriteButton({ favorited, onToggle }: { favorited: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-lagoon-950/40 text-sand-50 backdrop-blur-sm transition-colors hover:bg-lagoon-950/60"
    >
      <HeartIcon filled={favorited} className={cn("h-5 w-5", favorited ? "text-mango-400" : "")} />
    </button>
  );
}

export function RatingLine({ destination, className }: { destination: Destination; className?: string }) {
  const rating = toNumber(destination.rating);
  const reviewCount = destination.review_count;
  if (!rating && reviewCount === null) {
    return null;
  }
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <StarIcon className="h-4 w-4 text-mango-400" />
      <span className="font-semibold text-lagoon-900">{rating ? rating.toFixed(1) : "—"}</span>
      {reviewCount !== null ? <span className="text-ink-600">({formatCompactNumber(reviewCount)} reviews)</span> : null}
    </p>
  );
}

interface ExplorerCardProps {
  destination: Destination;
  favorited: boolean;
  onToggleFavorite: () => void;
  onAdd: () => void;
  containerRef?: Ref<HTMLDivElement>;
  highlighted?: boolean;
}

export function DestinationGridCard({
  destination,
  favorited,
  onToggleFavorite,
  onAdd,
  containerRef,
  highlighted,
}: ExplorerCardProps) {
  return (
    <div ref={containerRef} className={cn("rounded-2xl transition-shadow", highlighted && "ring-2 ring-surf-400")}>
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
          <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
            <CoverImage destination={destination} />
          </div>
          <CoverBadge destination={destination} />
          <FavoriteButton favorited={favorited} onToggle={onToggleFavorite} />
        </div>

        <div className="p-4">
          <h3 className="truncate font-display text-lg font-semibold leading-tight text-lagoon-900">{destination.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-sea-600">
            <PinIcon className="h-3.5 w-3.5" />
            {destinationLocation(destination)}
          </p>
          <RatingLine destination={destination} className="mt-1.5" />
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">{destination.description}</p>

          <div className="mt-4 flex gap-2">
            <Button className="flex-1" variant="secondary" size="sm" onClick={onAdd}>
              <PlusIcon className="h-3.5 w-3.5" /> Add
            </Button>
            <Link to={`/destinations/${destination.id}`} className="flex-1">
              <Button className="w-full" size="sm">
                View
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DestinationListCard({
  destination,
  favorited,
  onToggleFavorite,
  onAdd,
  containerRef,
  highlighted,
}: ExplorerCardProps) {
  return (
    <div ref={containerRef} className={cn("rounded-2xl transition-shadow", highlighted && "ring-2 ring-surf-400")}>
      <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md sm:flex-row">
        <div className="relative h-40 w-full shrink-0 overflow-hidden bg-sand-100 sm:h-auto sm:w-56 md:w-64">
          <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
            <CoverImage destination={destination} />
          </div>
          <CoverBadge destination={destination} />
          <FavoriteButton favorited={favorited} onToggle={onToggleFavorite} />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-xl font-semibold leading-tight text-lagoon-900">{destination.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-sea-600">
            <PinIcon className="h-3.5 w-3.5" />
            {destinationLocation(destination)}
          </p>
          <RatingLine destination={destination} className="mt-1.5" />
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">{destination.description}</p>

          <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
            <p className="text-xs font-bold text-lagoon-900">{formatMoney(destination.estimated_cost)}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onAdd}>
                <PlusIcon className="h-3.5 w-3.5" /> Add to trip
              </Button>
              <Link to={`/destinations/${destination.id}`}>
                <Button size="sm">View</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}