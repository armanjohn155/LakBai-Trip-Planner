import { useEffect, useState, type FormEvent } from "react";

import { ItineraryMap } from "@/components/features/itinerary/itinerary-map";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { STOP_CATEGORIES, STOP_STATUS_LABEL, STOP_STATUSES } from "@/components/features/itinerary/itinerary-constants";
import { apiError, deleteItineraryItem, updateItineraryItem } from "@/lib/api";
import type { Destination, Itinerary, ItineraryItem } from "@/lib/types";

interface StopEditorProps {
  open: boolean;
  itinerary: Itinerary;
  item: ItineraryItem | null;
  destinations: Destination[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface FormState {
  destinationId: string;
  customTitle: string;
  customAddress: string;
  latitude: string;
  longitude: string;
  dayNumber: string;
  startTime: string;
  durationMinutes: string;
  category: string;
  estimatedBudget: string;
  notes: string;
  status: string;
}

function initialState(item: ItineraryItem | null, destinations: Destination[]): FormState {
  if (!item) {
    return {
      destinationId: "",
      customTitle: "",
      customAddress: "",
      latitude: "",
      longitude: "",
      dayNumber: "1",
      startTime: "",
      durationMinutes: "",
      category: "",
      estimatedBudget: "",
      notes: "",
      status: "planned",
    };
  }

  const linkedDestination = item.destination_id !== null ? destinations.find((destination) => destination.id === item.destination_id) : undefined;

  return {
    destinationId: item.destination_id !== null ? String(item.destination_id) : "",
    customTitle: item.custom_title ?? linkedDestination?.name ?? item.title,
    customAddress: item.custom_address ?? "",
    latitude: item.latitude !== null ? String(item.latitude) : "",
    longitude: item.longitude !== null ? String(item.longitude) : "",
    dayNumber: String(item.day_number),
    startTime: item.start_time ? item.start_time.slice(0, 5) : "",
    durationMinutes: item.duration_minutes !== null ? String(item.duration_minutes) : "",
    category: item.category ?? "",
    estimatedBudget: item.estimated_budget != null ? String(item.estimated_budget) : "",
    notes: item.notes ?? "",
    status: item.status,
  };
}

export function StopEditor({ open, itinerary, item, destinations, onClose, onSaved }: StopEditorProps) {
  const [form, setForm] = useState<FormState>(() => initialState(item, destinations));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Re-seed the form whenever a different stop is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(initialState(item, destinations));
    setError(null);
  }, [item, destinations]);

  if (!item) return null;

  const isCustom = item.destination_id === null;
  const maxDay = Math.max(itinerary.day_count, 30);
  const lat = form.latitude === "" ? null : Number(form.latitude);
  const lng = form.longitude === "" ? null : Number(form.longitude);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = isCustom
        ? {
            custom_title: form.customTitle.trim(),
            custom_address: form.customAddress === "" ? null : form.customAddress,
            custom_latitude: lat,
            custom_longitude: lng,
            category: form.category === "" ? null : form.category,
            day_number: Number(form.dayNumber),
            start_time: form.startTime === "" ? null : form.startTime,
            duration_minutes: form.durationMinutes === "" ? null : Number(form.durationMinutes),
            estimated_budget: form.estimatedBudget === "" ? null : Number(form.estimatedBudget),
            notes: form.notes === "" ? null : form.notes,
            status: form.status as ItineraryItem["status"],
          }
        : {
            day_number: Number(form.dayNumber),
            start_time: form.startTime === "" ? null : form.startTime,
            duration_minutes: form.durationMinutes === "" ? null : Number(form.durationMinutes),
            estimated_budget: form.estimatedBudget === "" ? null : Number(form.estimatedBudget),
            notes: form.notes === "" ? null : form.notes,
            status: form.status as ItineraryItem["status"],
          };

      await updateItineraryItem(itinerary.id, item.id, payload);
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(apiError(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteItineraryItem(itinerary.id, item.id);
      await onSaved();
      onClose();
    } catch (deleteError) {
      setError(apiError(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;
  const canSave = !isCustom || form.customTitle.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={item.title}
      description={isCustom ? "Custom stop" : item.destination?.region ?? undefined}
      size="md"
      footer={
        <>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={busy}>
            {deleting ? "Removing…" : "Remove"}
          </Button>
          <Button type="submit" form="stop-editor-form" disabled={busy || !canSave}>
            {saving ? "Saving…" : "Save stop"}
          </Button>
        </>
      }
    >
      <form id="stop-editor-form" onSubmit={handleSubmit} className="space-y-4">
        {isCustom ? (
          <>
            <Input label="Stop name" value={form.customTitle} onChange={(event) => update({ customTitle: event.target.value })} required />
            <Input label="Address / label (optional)" value={form.customAddress} onChange={(event) => update({ customAddress: event.target.value })} />
          </>
        ) : (
          <div className="rounded-xl bg-sand-50/70 p-3 ring-1 ring-inset ring-line">
            <p className="text-sm font-semibold text-ink-900">{item.title}</p>
            {item.unavailable ? <p className="mt-0.5 text-xs text-mango-600">This destination is no longer available; the stop is kept for reference.</p> : null}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Day" type="number" min={1} max={maxDay} value={form.dayNumber} onChange={(event) => update({ dayNumber: event.target.value })} required />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => update({ status: event.target.value })}
            options={STOP_STATUSES.map((status) => ({ value: status, label: STOP_STATUS_LABEL[status] }))}
          />
          <Input label="Start time" type="time" value={form.startTime} onChange={(event) => update({ startTime: event.target.value })} />
          <Input
            label="Duration (minutes)"
            type="number"
            min={5}
            max={1440}
            placeholder="e.g. 90"
            value={form.durationMinutes}
            onChange={(event) => update({ durationMinutes: event.target.value })}
          />
          <Input
            label="Estimated budget (₱)"
            type="number"
            min={0}
            value={form.estimatedBudget}
            onChange={(event) => update({ estimatedBudget: event.target.value })}
          />
          <Select
            label="Category"
            emptyLabel="Use default"
            value={form.category}
            onChange={(event) => update({ category: event.target.value })}
            options={STOP_CATEGORIES.map((category) => ({ value: category, label: category }))}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-900">Notes</p>
          <textarea
            className="min-h-20 w-full rounded-xl bg-white/70 px-4 py-3 text-sm text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400"
            value={form.notes}
            maxLength={2000}
            placeholder="Arrive early, book tickets ahead…"
            onChange={(event) => update({ notes: event.target.value })}
          />
        </div>

        {isCustom ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink-900">Location</p>
            <div className="h-52 overflow-hidden rounded-2xl ring-1 ring-inset ring-line">
              <ItineraryMap
                items={[]}
                pickedPoint={lat !== null && lng !== null ? { lat, lng } : null}
                onPickPoint={(nextLat, nextLng) => update({ latitude: nextLat.toFixed(6), longitude: nextLng.toFixed(6) })}
                className="h-full w-full"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Latitude" value={form.latitude} onChange={(event) => update({ latitude: event.target.value })} />
              <Input label="Longitude" value={form.longitude} onChange={(event) => update({ longitude: event.target.value })} />
            </div>
            <p className="text-xs text-ink-600">Tap the map to place this stop, or type coordinates directly.</p>
          </div>
        ) : null}

        {error ? <InlineError message={error} /> : null}
      </form>
    </Modal>
  );
}
