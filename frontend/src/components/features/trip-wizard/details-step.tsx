import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateShort, inclusiveDayCount, isValidDateRange, type TripDraft } from "@/lib/trip-draft";

interface DetailsStepProps {
  draft: TripDraft;
  onChange: (patch: Partial<TripDraft>) => void;
  onNext: () => void;
}

export function DetailsStep({ draft, onChange, onNext }: DetailsStepProps) {
  const rangeValid = isValidDateRange(draft.startDate, draft.endDate);
  const dayCount = inclusiveDayCount(draft.startDate, draft.endDate);
  const dateError = draft.startDate && draft.endDate && !rangeValid;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!rangeValid) return;
    onNext();
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-5">
      <Card className="space-y-5 p-6">
        <div>
          <Input
            label="Trip name"
            placeholder="Leave blank for a suggested name"
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <p className="mt-1.5 text-xs text-ink-600">
            Suggested: <span className="font-medium text-lagoon-900">Cebu Trip – {draft.startDate || "…"}&ndash;{draft.endDate || "…"}</span>
          </p>
        </div>

        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start date"
              type="date"
              value={draft.startDate}
              onChange={(event) => onChange({ startDate: event.target.value })}
              aria-invalid={Boolean(dateError)}
            />
            <Input
              label="End date"
              type="date"
              value={draft.endDate}
              onChange={(event) => onChange({ endDate: event.target.value })}
              aria-invalid={Boolean(dateError)}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            {rangeValid ? (
              <p className="font-semibold text-sea-600">
                {formatDateShort(draft.startDate)} → {formatDateShort(draft.endDate)} · {dayCount} {dayCount === 1 ? "day" : "days"}
              </p>
            ) : dateError ? (
              <p className="text-red-600">The end date must be on or after the start date.</p>
            ) : (
              <p className="text-ink-600">Pick the dates your trip covers.</p>
            )}
          </div>
        </div>

        <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4">
          <Input
            label="Budget (₱) — optional"
            type="number"
            min={0}
            placeholder="e.g. 25000"
            value={draft.noBudgetLimit ? "" : draft.budget}
            disabled={draft.noBudgetLimit}
            onChange={(event) => onChange({ budget: event.target.value })}
          />
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-900 sm:mt-0 sm:pb-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-surf-400"
              checked={draft.noBudgetLimit}
              onChange={(event) => onChange({ noBudgetLimit: event.target.checked, budget: event.target.checked ? "" : draft.budget })}
            />
            No budget limit
          </label>
        </div>
        {draft.noBudgetLimit ? (
          <p className="text-xs text-ink-600">Budget tracking is skipped for this trip. You can set one later from the trip settings.</p>
        ) : null}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!rangeValid}>
          Next · Itinerary
        </Button>
      </div>
    </form>
  );
}