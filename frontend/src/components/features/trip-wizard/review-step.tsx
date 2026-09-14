import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarIcon } from "@/components/icons";
import { InlineError } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatMoney, pluralise, toNumber } from "@/lib/format";
import { draftBudgetBreakdown, draftItemTotal, formatDateShort, type TripDraft } from "@/lib/trip-draft";

interface ReviewStepProps {
  draft: TripDraft;
  dayCount: number;
  onBack: () => void;
  onCreate: () => void;
  submitting: boolean;
  error: string | null;
}

export function ReviewStep({ draft, dayCount, onBack, onCreate, submitting, error }: ReviewStepProps) {
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);
  const total = draftItemTotal(draft.items);
  const budget = draft.noBudgetLimit || draft.budget === "" ? null : toNumber(draft.budget);
  const diff = budget === null ? null : total - budget;
  const breakdown = draftBudgetBreakdown(draft.items);
  const maxCategory = Math.max(...breakdown.map((entry) => entry.estimated_budget), 1);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">Trip</p>
            <h2 className="font-display text-2xl font-semibold text-lagoon-900">{draft.title || "Untitled trip"}</h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-ink-600">
            <CalendarIcon className="h-4 w-4" />
            {formatDateShort(draft.startDate)} → {formatDateShort(draft.endDate)} · {pluralise(dayCount, "day")}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-display text-xl font-medium text-lagoon-900">Itinerary</h3>
          <span className="text-sm text-ink-600">{pluralise(draft.items.length, "stop")}</span>
        </div>

        {draft.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-600">No stops yet — you can add them after creating the trip.</p>
        ) : (
          <div className="space-y-5">
            {days.map((dayNumber) => {
              const stops = draft.items
                .filter((item) => item.dayIndex === dayNumber)
                .sort((a, b) => a.order - b.order);
              if (stops.length === 0) return null;
              return (
                <section key={dayNumber}>
                  <h4 className="mb-2 rounded-full bg-lagoon-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-surf-300">
                    Day {dayNumber}
                  </h4>
                  <ol className="space-y-2">
                    {stops.map((item, index) => (
                      <li key={item.uid} className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sm font-semibold text-sea-600">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold text-lagoon-900">{item.destination.name}</p>
                            <p className="text-sm font-semibold text-ink-900">{formatMoney(item.estimated_budget)}</p>
                          </div>
                          <p className="text-xs text-ink-600">{item.destination.municipality ?? item.destination.region}</p>
                          {item.notes.trim() !== "" ? <p className="mt-1 text-sm text-ink-600">{item.notes}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">Estimated total</p>
            <p className="font-display text-3xl font-semibold text-lagoon-900">{formatMoney(total)}</p>
          </div>
          {budget === null ? (
            <Badge tone="neutral">No budget limit</Badge>
          ) : diff === null ? null : diff <= 0 ? (
            <Badge tone="surf">{diff === 0 ? "Exactly on budget" : `${formatMoney(Math.abs(diff))} under a ${formatMoney(budget)} budget`}</Badge>
          ) : (
            <Badge tone="mango">{formatMoney(diff)} over a {formatMoney(budget)} budget</Badge>
          )}
        </div>

        {breakdown.length > 0 ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-ink-900">Breakdown by category</p>
            {breakdown.map((entry) => (
              <div key={entry.category}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-ink-900">{entry.category}</span>
                  <span className="text-ink-600">{formatMoney(entry.estimated_budget)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-100">
                  <div className={cn("h-full rounded-full", diff !== null && diff > 0 ? "bg-mango-400" : "bg-surf-400")} style={{ width: `${(entry.estimated_budget / maxCategory) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {error ? <InlineError message={error} /> : null}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          ← Back
        </Button>
        <Button size="lg" onClick={onCreate} disabled={submitting}>
          {submitting ? "Creating trip…" : "Create Trip"}
        </Button>
      </div>
    </div>
  );
}