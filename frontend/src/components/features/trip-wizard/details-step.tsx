import type { FormEvent } from "react";

import { FriendPicker } from "@/components/features/sharing/friend-picker";
import { FriendsIcon, UserIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatDateShort, inclusiveDayCount, isValidDateRange, type TripDraft } from "@/lib/trip-draft";
import type { FriendUser } from "@/lib/types";

interface DetailsStepProps {
  draft: TripDraft;
  friends: FriendUser[];
  friendsLoading: boolean;
  onChange: (patch: Partial<TripDraft>) => void;
  onNext: () => void;
}

export function DetailsStep({ draft, friends, friendsLoading, onChange, onNext }: DetailsStepProps) {
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

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-ink-900">Who is coming?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ tripType: "solo" })}
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4 text-left ring-1 ring-inset transition-colors",
                draft.tripType === "solo" ? "bg-surf-400/10 ring-surf-400" : "bg-white/50 ring-line hover:bg-sand-100/60",
              )}
              aria-pressed={draft.tripType === "solo"}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lagoon-900 text-sand-50">
                <UserIcon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">Just me</span>
                <span className="mt-0.5 block text-xs text-ink-600">A private planner for this trip.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ tripType: "group" })}
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4 text-left ring-1 ring-inset transition-colors",
                draft.tripType === "group" ? "bg-surf-400/10 ring-surf-400" : "bg-white/50 ring-line hover:bg-sand-100/60",
              )}
              aria-pressed={draft.tripType === "group"}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surf-400 text-white">
                <FriendsIcon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">With friends</span>
                <span className="mt-0.5 block text-xs text-ink-600">Invite accepted friends as editors or viewers.</span>
              </span>
            </button>
          </div>

          {draft.tripType === "group" ? (
            <div className="space-y-3 rounded-2xl bg-sand-100/60 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Invite friends</p>
                  <p className="text-xs text-ink-600">They will join after accepting. You can invite more later.</p>
                </div>
                <Select
                  label="Their role"
                  value={draft.inviteRole}
                  onChange={(event) => onChange({ inviteRole: event.target.value as "editor" | "viewer" })}
                  options={[
                    { value: "editor", label: "Editor - can change the plan" },
                    { value: "viewer", label: "Viewer - can only look" },
                  ]}
                  className="h-9 w-56 text-sm"
                />
              </div>
              <FriendPicker
                friends={friends}
                selected={draft.invitees}
                onChange={(invitees) => onChange({ invitees })}
                loading={friendsLoading}
                idPrefix="wizard-friend"
              />
            </div>
          ) : null}
        </fieldset>

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