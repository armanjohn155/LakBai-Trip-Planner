import { useState } from "react";

import { BudgetDetails, isBudgetHidden } from "@/components/features/itinerary/budget-summary";
import { ChevronIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney, toNumber } from "@/lib/format";
import type { ItinerarySummary } from "@/lib/types";

export function BudgetFooter({ summary, className }: { summary: ItinerarySummary; className?: string }) {
  const [open, setOpen] = useState(false);
  const hidden = isBudgetHidden(summary);
  const total = toNumber(summary.total_budget);
  const limit = summary.budget_limit === null ? null : toNumber(summary.budget_limit);
  const diff = limit === null ? null : total - limit;

  return (
    <div className={cn("border-t border-line/70 bg-white/95", className)}>
      {open ? (
        <div className="max-h-[45vh] overflow-y-auto border-b border-line/60 px-4 py-3">
          <BudgetDetails summary={summary} />
        </div>
      ) : null}

      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Estimated total</p>
          <p className="truncate text-base font-semibold text-lagoon-900">{hidden ? "Private" : formatMoney(total)}</p>
          {!hidden && diff !== null ? (
            <p className={cn("text-[11px] font-medium", diff > 0 ? "text-sinulog-red" : "text-sea-600")}>
              {formatMoney(Math.abs(diff))} {diff > 0 ? "over budget" : "left"}
            </p>
          ) : (
            <p className="text-[11px] text-ink-500">
              {hidden ? "Budget hidden by the owner" : "No budget limit set"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Hide budget details" : "Show budget details"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100 hover:text-ink-900"
        >
          <ChevronIcon className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "rotate-0")} />
        </button>
      </div>
    </div>
  );
}
