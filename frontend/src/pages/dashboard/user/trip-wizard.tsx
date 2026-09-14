import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { DetailsStep } from "@/components/features/trip-wizard/details-step";
import { ItineraryStep } from "@/components/features/trip-wizard/itinerary-step";
import { ReviewStep } from "@/components/features/trip-wizard/review-step";
import { StepIndicator } from "@/components/features/trip-wizard/step-indicator";
import { XIcon } from "@/components/icons";
import { apiError, addItineraryItem, createItinerary, getDestinations } from "@/lib/api";
import { toNumber } from "@/lib/format";
import {
  clearDraft,
  emptyTripDraft,
  hasDraftData,
  inclusiveDayCount,
  nextUid,
  persistDraft,
  restoreDraft,
  suggestedDraftTitle,
  type DraftItem,
  type TripDraft,
} from "@/lib/trip-draft";
import type { Destination } from "@/lib/types";

export default function TripWizardPage() {
  const navigate = useNavigate();
  const [restored] = useState(restoreDraft);
  const [draft, setDraft] = useState<TripDraft>(() => restored?.draft ?? emptyTripDraft());
  const [step, setStep] = useState(() => restored?.step ?? 1);
  const [maxStep, setMaxStep] = useState(() => restored?.step ?? 1);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dayCount = inclusiveDayCount(draft.startDate, draft.endDate);
  const hasData = hasDraftData(draft);

  useEffect(() => {
    persistDraft(draft, step);
  }, [draft, step]);

  useEffect(() => {
    let cancelled = false;
    getDestinations({ per_page: 100 })
      .then((page) => {
        if (!cancelled) setDestinations(page.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const goToStep = (next: number) => {
    setStep(next);
    setMaxStep((current) => Math.max(current, next));
  };

  const goNextFromDetails = () => {
    const normalized: TripDraft = {
      ...draft,
      title: draft.title.trim() || suggestedDraftTitle(draft),
      items: draft.items
        .map((item) => ({ ...item, dayIndex: Math.min(Math.max(item.dayIndex, 1), Math.max(dayCount, 1)) }))
        .filter(() => dayCount > 0),
    };
    setDraft(normalized);
    goToStep(2);
  };

  const goNextFromItinerary = () => goToStep(3);

  const handleDiscard = () => {
    const discard = !hasData || window.confirm("Discard this trip? Your entered details and stops will be lost.");
    if (discard) {
      setDraft(emptyTripDraft());
      clearDraft();
      navigate("/app/trips");
    }
  };

  const updateDraft = (patch: Partial<TripDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const addItem = (destination: Destination, dayIndex: number) => {
    setDraft((current) => {
      const order = current.items.filter((item) => item.dayIndex === dayIndex).length;
      const item: DraftItem = {
        uid: nextUid(),
        destination,
        dayIndex,
        order,
        estimated_budget: destination.estimated_cost ?? "",
        notes: "",
      };
      return { ...current, items: [...current.items, item] };
    });
  };

  const updateItem = (uid: string, patch: Partial<DraftItem>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.uid === uid ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (uid: string) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.uid !== uid) }));
  };

  const reorderInDay = (dayIndex: number, fromUid: string, toUid: string) => {
    setDraft((current) => {
      const dayItems = current.items
        .filter((item) => item.dayIndex === dayIndex)
        .sort((a, b) => a.order - b.order);
      const fromIndex = dayItems.findIndex((item) => item.uid === fromUid);
      const toIndex = dayItems.findIndex((item) => item.uid === toUid);
      if (fromIndex === -1 || toIndex === -1) return current;
      const [moved] = dayItems.splice(fromIndex, 1);
      dayItems.splice(toIndex, 0, moved);
      const orderById = new Map(dayItems.map((item, index) => [item.uid, index]));
      return {
        ...current,
        items: current.items.map((item) => (orderById.has(item.uid) ? { ...item, order: orderById.get(item.uid) as number } : item)),
      };
    });
  };

  const createTrip = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const title = draft.title.trim() || suggestedDraftTitle(draft);
      const budget = draft.noBudgetLimit || draft.budget === "" ? null : toNumber(draft.budget);
      const trip = await createItinerary({
        title,
        start_date: draft.startDate,
        end_date: draft.endDate,
        budget,
      });

      const sortedItems = [...draft.items].sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
      for (const item of sortedItems) {
        await addItineraryItem(trip.id, {
          destination_id: item.destination.id,
          day_number: Math.min(item.dayIndex, Math.max(dayCount, 1)),
          estimated_budget: item.estimated_budget === "" ? null : toNumber(item.estimated_budget),
          notes: item.notes.trim() === "" ? null : item.notes.trim(),
          order: item.order,
        });
      }

      clearDraft();
      setDraft(emptyTripDraft());
      navigate(`/app/trips/${trip.id}`, { replace: true });
    } catch (error) {
      setSubmitError(apiError(error));
      setSubmitting(false);
    }
  };

  const stepTitle = useMemo(
    () => (step === 1 ? "Details" : step === 2 ? "Itinerary" : "Review"),
    [step],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">Plan Your Trip</h1>
          <p className="mt-1 text-sm text-ink-600">
            Step {step} of 3 · {stepTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          aria-label="Close wizard"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <StepIndicator current={step} maxStep={maxStep} onSelect={goToStep} />

      {step === 1 ? (
        <DetailsStep draft={draft} onChange={updateDraft} onNext={goNextFromDetails} />
      ) : step === 2 ? (
        <ItineraryStep
          draft={draft}
          dayCount={dayCount}
          destinations={destinations}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onReorderInDay={reorderInDay}
          onBack={() => goToStep(1)}
          onNext={goNextFromItinerary}
        />
      ) : (
        <ReviewStep
          draft={draft}
          dayCount={dayCount}
          onBack={() => goToStep(2)}
          onCreate={createTrip}
          submitting={submitting}
          error={submitError}
        />
      )}
    </div>
  );
}