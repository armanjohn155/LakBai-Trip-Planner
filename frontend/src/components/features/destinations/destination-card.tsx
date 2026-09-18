import { PinIcon } from "@/components/icons";
import { categoryTag, categoryTone, destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface DestinationCardProps {
  destination: Destination;
  onClick?: (destination: Destination) => void;
}

export function DestinationCard({ destination, onClick }: DestinationCardProps) {
  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md",
        onClick ? "cursor-pointer" : "",
      )}
      onClick={onClick ? () => onClick(destination) : undefined}
    >
      <div className={cn("relative h-44 overflow-hidden bg-gradient-to-br", categoryTone(destination.category))}>
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
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
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-royal-950/85 via-royal-950/35 to-royal-950/5" aria-hidden="true" />

        <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md ring-1 ring-inset ring-white/40">
          {formatMoney(destination.estimated_cost)}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
          <span className="w-fit rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-sand-50 backdrop-blur-md ring-1 ring-inset ring-white/30">
            {categoryTag(destination.category)}
          </span>
          <p className="truncate font-display text-xl font-semibold leading-tight text-white">{destination.name}</p>
          <p className="flex items-center gap-1 text-xs font-medium text-sand-50/85">
            <PinIcon className="h-3.5 w-3.5" />
            {destinationLocation(destination)}
          </p>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className={cn("absolute inset-0 bg-gradient-to-br", categoryTone(destination.category))} aria-hidden="true" />
        {destination.image_url ? (
          <img
            src={destination.image_url}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <div className="relative p-4">
          <p className="line-clamp-2 text-sm leading-relaxed text-white">{destination.description}</p>
        </div>
      </div>
    </Card>
  );
}
