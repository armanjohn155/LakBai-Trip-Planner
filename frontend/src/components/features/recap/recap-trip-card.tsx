import { useEffect, useState } from "react";

import { formatTripDateRange } from "@/components/features/itinerary/itinerary-constants";
import { TRIP_PLACEHOLDER_IMAGE } from "@/components/features/itinerary/trip-card";
import { CalendarIcon, CheckIcon, RouteIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTripRecap } from "@/lib/api";
import { formatDistance } from "@/lib/geo";
import type { Itinerary, TripRecap } from "@/lib/types";

import { resolveRecapMediaUrl } from "./recap-utils";

interface RecapTripCardProps {
  itinerary: Itinerary;
  onOpen: () => void;
  onPlanAgain: () => void;
  planAgainBusy: boolean;
}

export function RecapTripCard({ itinerary, onOpen, onPlanAgain, planAgainBusy }: RecapTripCardProps) {
  const [recap, setRecap] = useState<TripRecap | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getTripRecap(itinerary.id)
      .then((data) => {
        if (active) setRecap(data);
      })
      .catch(() => {
        // The card still has useful trip metadata if its recap is unavailable.
      });
    return () => {
      active = false;
    };
  }, [itinerary.id]);

  const fallbackImage = itinerary.cover_image_url
    ?? itinerary.items?.map((item) => item.destination?.image_url).find(Boolean)
    ?? TRIP_PLACEHOLDER_IMAGE;
  const coverUrl = imageFailed
    ? TRIP_PLACEHOLDER_IMAGE
    : resolveRecapMediaUrl(recap?.cover_photo?.url ?? fallbackImage) ?? TRIP_PLACEHOLDER_IMAGE;
  const range = formatTripDateRange(itinerary.start_date, itinerary.end_date);
  const distance = recap?.stats?.distance_m ?? itinerary.distance_m ?? 0;
  const stops = recap?.stats?.stops_total ?? itinerary.item_count ?? itinerary.items?.length ?? 0;

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={onOpen} className="group block w-full text-left" aria-label={`Open recap: ${itinerary.title}`}>
        <div className="relative h-44 overflow-hidden bg-sand-100">
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-lagoon-950/70 to-transparent" />
          <Badge className="absolute left-3 top-3" tone="sea"><CheckIcon className="mr-1 h-3 w-3" /> Completed</Badge>
          <h2 className="absolute bottom-3 left-4 right-4 line-clamp-2 font-display text-xl font-semibold text-white">{itinerary.title}</h2>
        </div>
      </button>
      <div className="space-y-4 p-4">
        <p className="flex items-center gap-1.5 text-sm text-ink-600">
          <CalendarIcon className="h-4 w-4" /> {range ?? "Dates not set"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral"><RouteIcon className="mr-1 h-3 w-3" /> {formatDistance(distance)}</Badge>
          <Badge tone="neutral">{stops} {stops === 1 ? "stop" : "stops"}</Badge>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onOpen}>Open recap</Button>
          <Button variant="secondary" onClick={onPlanAgain} disabled={planAgainBusy}>
            {planAgainBusy ? "Copying…" : "Plan again"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
