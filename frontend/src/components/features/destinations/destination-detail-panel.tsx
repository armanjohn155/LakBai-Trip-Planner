import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface DestinationDetailPanelProps {
  destination: Destination;
  action?: ReactNode;
}

export function DestinationDetailPanel({ destination, action }: DestinationDetailPanelProps) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-lagoon-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-surf-300">{destination.region}</p>
        <h3 className="mt-1 font-display text-2xl font-semibold leading-tight text-sand-50">{destination.name}</h3>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-ink-600">{destination.description}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="surf">{destination.category}</Badge>
          <Badge tone="mango">{formatMoney(destination.estimated_cost)} per visit</Badge>
        </div>

        {destination.best_time_to_visit ? (
          <div className="rounded-xl bg-sand-100 px-3 py-2.5 text-sm">
            <span className="font-semibold text-ink-900">Best time to visit</span>
            <p className="text-ink-600">{destination.best_time_to_visit}</p>
          </div>
        ) : null}

        {destination.tips ? (
          <div>
            <p className="text-sm font-semibold text-ink-900">Local tip</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{destination.tips}</p>
          </div>
        ) : null}

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </Card>
  );
}

export function AddToItineraryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button className="w-full" onClick={onClick}>
      Add to itinerary
    </Button>
  );
}