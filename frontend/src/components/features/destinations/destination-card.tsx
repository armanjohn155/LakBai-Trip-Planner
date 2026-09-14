import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

const categoryTones: Record<string, string> = {
  Beach: "bg-sea-500",
  Waterfall: "bg-lagoon-800",
  Island: "bg-surf-400",
  Heritage: "bg-ink-900",
  Food: "bg-mango-400",
  Viewpoint: "bg-lagoon-700",
};

const defaultTone = "bg-lagoon-800";

interface DestinationCardProps {
  destination: Destination;
  onClick?: (destination: Destination) => void;
}

export function DestinationCard({ destination, onClick }: DestinationCardProps) {
  const tone = categoryTones[destination.category] ?? defaultTone;

  return (
    <Card
      className={cn("group overflow-hidden transition-shadow hover:shadow-md", onClick ? "cursor-pointer" : "")}
      onClick={onClick ? () => onClick(destination) : undefined}
    >
      <div className={cn("relative flex h-28 items-end justify-between bg-gradient-to-br p-4", tone)}>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold text-white drop-shadow-sm">{destination.name}</p>
          <p className="text-xs font-medium text-white/75">{destination.region}</p>
        </div>
        <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
          {formatMoney(destination.estimated_cost)}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="surf">{destination.category}</Badge>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">{destination.description}</p>
      </div>
    </Card>
  );
}