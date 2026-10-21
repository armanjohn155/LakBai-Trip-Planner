import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney, pluralise, toNumber } from "@/lib/format";
import { formatDuration } from "@/components/features/itinerary/itinerary-constants";
import type { ItinerarySummary } from "@/lib/types";

export function BudgetSummary({ summary }: { summary: ItinerarySummary }) {
  const maxCategory = Math.max(...summary.breakdown_by_category.map((entry) => entry.estimated_budget), 1);
  const total = toNumber(summary.total_budget);
  const limit = summary.budget_limit === null ? null : toNumber(summary.budget_limit);
  const diff = limit === null ? null : total - limit;

  return (
    <Card className="overflow-hidden">
      <div className="bg-lagoon-900 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-surf-300">Estimated total</p>
          {diff === null ? null : diff > 0 ? (
            <span className="rounded-full bg-mango-400 px-2.5 py-0.5 text-xs font-bold text-lagoon-950">Over budget</span>
          ) : diff === 0 ? (
            <span className="rounded-full bg-surf-400/25 px-2.5 py-0.5 text-xs font-semibold text-surf-200">On budget</span>
          ) : (
            <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">Under budget</span>
          )}
        </div>
        <p className="mt-1 font-display text-4xl font-semibold text-sand-50">{formatMoney(total)}</p>
        {limit === null ? (
          <p className="mt-1 text-xs text-surf-300/80">No budget limit set for this trip.</p>
        ) : (
          <p className="mt-1 text-xs text-surf-300/80">
            Budget limit {formatMoney(limit)}
            {diff === null || diff === 0 ? "" : ` · ${formatMoney(Math.abs(diff))} ${diff > 0 ? "over" : "under"}`}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="surf">{pluralise(summary.day_count, "day")}</Badge>
          <Badge tone="mango">{pluralise(summary.item_count, "stop")}</Badge>
          {summary.total_duration_minutes > 0 ? <Badge tone="neutral">{formatDuration(summary.total_duration_minutes)} planned</Badge> : null}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {summary.days.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-ink-900">Per-day subtotals</p>
            <ul className="mt-2 space-y-1.5">
              {summary.days.map((day) => (
                <li key={day.day_number} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-600">
                    Day {day.day_number} · {pluralise(day.item_count, "stop")}
                    {day.duration_minutes > 0 ? ` · ${formatDuration(day.duration_minutes)}` : ""}
                  </span>
                  <span className="font-medium text-ink-900">{formatMoney(day.estimated_budget)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-semibold text-ink-900">Breakdown by category</p>
          {summary.breakdown_by_category.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600">Add stops to see a cost breakdown.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {summary.breakdown_by_category.map((entry) => (
                <li key={entry.category}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-ink-900">{entry.category}</span>
                    <span className="text-ink-600">{formatMoney(entry.estimated_budget)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className={cn("h-full rounded-full bg-surf-400")}
                      style={{ width: `${(entry.estimated_budget / maxCategory) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-ink-600">Per-stop estimates from our curated list, in pesos.</p>
      </div>
    </Card>
  );
}
