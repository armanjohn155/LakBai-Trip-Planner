import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface ExplorerListItemProps {
  destination: Destination;
  hovered: boolean;
  selected: boolean;
  chooser?: ReactNode;
  listRef?: (element: HTMLLIElement | null) => void;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onToggleAdd: () => void;
}

export function ExplorerListItem({ destination, hovered, selected, chooser, listRef, onHover, onLeave, onClick, onToggleAdd }: ExplorerListItemProps) {
  return (
    <li ref={listRef}>
      <div
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={onClick}
        className={cn(
          "glass cursor-pointer rounded-2xl p-4 transition-shadow",
          selected ? "ring-2 ring-surf-400 shadow-sm" : hovered ? "ring-surf-400/60 shadow-sm" : "ring-line",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold leading-tight text-lagoon-900">{destination.name}</h3>
              <Badge tone="surf">{destination.category}</Badge>
            </div>
            <p className="mt-0.5 text-sm font-medium text-sea-600">{destination.region}</p>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">{destination.description}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-bold text-lagoon-900">{formatMoney(destination.estimated_cost)}</span>
            <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); onToggleAdd(); }}>
              <PlusIcon className="h-3.5 w-3.5" /> Add to trip
            </Button>
          </div>
        </div>
      </div>
      {chooser ? <div className="glass mt-2 rounded-2xl p-4">{chooser}</div> : null}
    </li>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}