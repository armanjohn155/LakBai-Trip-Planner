import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CoordinatePicker } from "@/components/features/admin/coordinate-picker";
import { DestinationFormPreview } from "@/components/features/admin/destination-form-preview";
import { GalleryUploader, type GalleryItem } from "@/components/features/admin/destination-form/GalleryUploader";
import { RepeatableList } from "@/components/features/admin/destination-form/RepeatableList";
import { TagInput } from "@/components/features/admin/destination-form/TagInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { FieldHint, Input, Select } from "@/components/ui/input";
import { apiError, apiFieldErrors, createAdminDestination, updateAdminDestination } from "@/lib/api";
import { CEBU_BOUNDS, DESTINATION_CATEGORIES, DESTINATION_REGIONS, MUNICIPALITY_SUGGESTIONS } from "@/lib/destination-constants";
import type { Destination } from "@/lib/types";

interface V {
  name: string;
  description: string;
  category: string;
  region: string;
  municipality: string;
  latitude: string;
  longitude: string;
  estimated_cost: string;
  best_time_to_visit: string;
  tips: string;
  entrance_fee_text: string;
  visit_duration: string;
  opening_hours: string;
  highlights: string[];
  how_to_get_there: Array<{ mode?: string; route?: string; duration?: string; price_text?: string }>;
  travel_tips: string[];
}

const empty: V = {
  name: "",
  description: "",
  category: "",
  region: "",
  municipality: "",
  latitude: "",
  longitude: "",
  estimated_cost: "",
  best_time_to_visit: "",
  tips: "",
  entrance_fee_text: "",
  visit_duration: "",
  opening_hours: "",
  highlights: [],
  how_to_get_there: [],
  travel_tips: [],
};

const from = (d?: Destination): V =>
  d
    ? {
        name: d.name,
        description: d.description,
        category: d.category,
        region: d.region,
        municipality: d.municipality ?? "",
        latitude: d.latitude,
        longitude: d.longitude,
        estimated_cost: d.estimated_cost ?? "",
        best_time_to_visit: d.best_time_to_visit ?? "",
        tips: d.tips ?? "",
        entrance_fee_text: d.entrance_fee_text ?? "",
        visit_duration: d.visit_duration ?? "",
        opening_hours: d.opening_hours ?? "",
        highlights: Array.isArray(d.highlights) ? d.highlights : [],
        how_to_get_there: Array.isArray(d.how_to_get_there) ? d.how_to_get_there : [],
        travel_tips: Array.isArray(d.travel_tips) ? d.travel_tips : [],
      }
    : empty;

const ta =
  "min-h-24 w-full rounded-xl bg-white/70 px-4 py-3 text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400 backdrop-blur-sm";

export function DestinationForm({ destination }: { destination?: Destination }) {
  const nav = useNavigate();
  const edit = Boolean(destination);
  const [v, setV] = useState<V>(() => from(destination));
  const [items, setItems] = useState<GalleryItem[]>(() => {
    if (destination?.gallery && destination.gallery.length > 0) {
      return destination.gallery.map((u, i) => ({ id: `e${i}`, url: u }));
    }
    if (destination?.image_url) {
      return [{ id: "e0", url: destination.image_url }];
    }
    return [];
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [ferr, setFerr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState(false);

  const setF = (k: keyof V, val: any) => {
    setV((c) => ({ ...c, [k]: val }));
    setErrs((c) => {
      if (!(k in c)) return c;
      const n = { ...c };
      delete n[k];
      return n;
    });
  };

  const out = useMemo(() => {
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (v.latitude === "" || v.longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return lat < CEBU_BOUNDS.minLat || lat > CEBU_BOUNDS.maxLat || lng < CEBU_BOUNDS.minLng || lng > CEBU_BOUNDS.maxLng;
  }, [v.latitude, v.longitude]);

  const pvals = useMemo(() => ({ ...v, galleryItems: items }), [v, items]);

  const sub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrs({});
    setFerr(null);
    const fd = new FormData();
    (Object.keys(v) as (keyof V)[]).forEach((k) => {
      const val = v[k];
      if (Array.isArray(val)) {
        fd.append(k, JSON.stringify(val));
      } else {
        fd.append(k, val == null ? "" : String(val));
      }
    });
    items.forEach((it) => {
      if (it.file) fd.append("images[]", it.file);
      else if (it.url) fd.append("gallery[]", it.url);
    });
    if (items.length > 0) fd.append("cover_index", "0");
    try {
      if (destination) {
        await updateAdminDestination(destination.id, fd);
      } else {
        await createAdminDestination(fd);
      }
      nav("/admin/destinations", { replace: true, state: { toast: edit ? `${v.name} was updated.` : `${v.name} was added.` } });
    } catch (err: any) {
      const fe = apiFieldErrors(err);
      setErrs(fe);
      if (Object.keys(fe).length === 0) setFerr(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={sub} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">{edit ? `Edit ${destination?.name}` : "New destination"}</h1>
          <p className="mt-1 text-sm text-ink-600">{edit ? "Update the details travelers see." : "Add a place to the shared destination library."}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setPrev((p) => !p)}>{prev ? "Hide preview" : "Show preview"}</Button>
      </div>
      {ferr ? <InlineError message={ferr} /> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-lagoon-900">Basics</h2>
              <p className="text-sm text-ink-600">Core details shown at the top</p>
            </div>
            <Input label="Name" name="name" value={v.name} onChange={(e) => setF("name", e.target.value)} error={errs.name} placeholder="Kawasan Falls" required />
            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-sm font-semibold text-ink-900">Description</label>
              <textarea id="description" name="description" className={ta} value={v.description} onChange={(e) => setF("description", e.target.value)} placeholder="What makes this place worth the trip?" required />
              {errs.description ? <p className="text-sm text-red-600">{errs.description}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Category" name="category" value={v.category} onChange={(e) => setF("category", e.target.value)} error={errs.category} emptyLabel="Choose a category" options={DESTINATION_CATEGORIES.map((c) => ({ value: c, label: c }))} required />
              <Select label="Region" name="region" value={v.region} onChange={(e) => setF("region", e.target.value)} error={errs.region} emptyLabel="Choose a region" options={DESTINATION_REGIONS.map((r) => ({ value: r, label: r }))} required />
            </div>
            <div className="space-y-1.5">
              <Input label="Municipality" name="municipality" value={v.municipality} onChange={(e) => setF("municipality", e.target.value)} error={errs.municipality} placeholder="Badian" list="ms" />
              <datalist id="ms">{MUNICIPALITY_SUGGESTIONS.map((m) => (<option key={m} value={m} />))}</datalist>
            </div>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6"><GalleryUploader items={items} onChange={setItems} error={errs.images || errs.gallery} /></Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold text-lagoon-900">Highlights</h2><p className="text-sm text-ink-600">Tag chips shown on the detail page</p></div>
            <TagInput value={v.highlights} onChange={(tags) => setF("highlights", tags)} placeholder="Type and press Enter (e.g., Canyoneering)" max={12} maxLength={40} error={errs.highlights} />
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold text-lagoon-900">About</h2><p className="text-sm text-ink-600">Main description</p></div>
            <div className="space-y-1.5">
              <textarea className={ta} value={v.description} onChange={(e) => setF("description", e.target.value)} placeholder="What makes this place worth the trip?" />
              {errs.description ? <p className="text-sm text-red-600">{errs.description}</p> : null}
            </div>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold text-lagoon-900">Quick info</h2><p className="text-sm text-ink-600">Entrance fee, duration, hours, cost</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Entrance fee text" value={v.entrance_fee_text} onChange={(e) => setF("entrance_fee_text", e.target.value)} placeholder="₱2,500 (guided tour)" />
              <Input label="Estimated cost (₱)" type="number" min={0} step="0.01" value={v.estimated_cost} onChange={(e) => setF("estimated_cost", e.target.value)} error={errs.estimated_cost} placeholder="500" />
              <Input label="Visit duration" value={v.visit_duration} onChange={(e) => setF("visit_duration", e.target.value)} placeholder="4-6 hours" />
              <Input label="Opening hours" value={v.opening_hours} onChange={(e) => setF("opening_hours", e.target.value)} placeholder="8:00 AM - 4:00 PM" />
              <Input label="Best time to visit" value={v.best_time_to_visit} onChange={(e) => setF("best_time_to_visit", e.target.value)} error={errs.best_time_to_visit} placeholder="Early morning, dry season" />
            </div>
            <FieldHint>Estimated cost is used for itinerary totals.</FieldHint>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold text-lagoon-900">How to get there</h2><p className="text-sm text-ink-600">Transport options shown on the page</p></div>
            <RepeatableList type="transport" transportValue={v.how_to_get_there} onTransportChange={(rows) => setF("how_to_get_there", rows)} error={errs.how_to_get_there} />
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold text-lagoon-900">Travel tips</h2><p className="text-sm text-ink-600">Numbered tips on the detail page</p></div>
            <RepeatableList type="tips" tipsValue={v.travel_tips} onTipsChange={(tips) => setF("travel_tips", tips)} error={errs.travel_tips} />
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-ink-900">Legacy tips (kept for compatibility)</label>
              <textarea className={ta} value={v.tips} onChange={(e) => setF("tips", e.target.value)} placeholder="Bring a dry bag, cash for entrance fees…" />
              {errs.tips ? <p className="text-sm text-red-600">{errs.tips}</p> : null}
            </div>
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold text-lagoon-900">Location</h2><p className="text-sm text-ink-600">Coordinates and map pin</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Latitude" name="latitude" type="number" step="any" min={-90} max={90} value={v.latitude} onChange={(e) => setF("latitude", e.target.value)} error={errs.latitude} placeholder="9.8019444" required />
              <Input label="Longitude" name="longitude" type="number" step="any" min={-180} max={180} value={v.longitude} onChange={(e) => setF("longitude", e.target.value)} error={errs.longitude} placeholder="123.3738889" required />
            </div>
            {out ? <p className="rounded-xl bg-mango-400/20 px-4 py-3 text-sm text-lagoon-900">These coordinates are outside Cebu. Double-check the pin before saving.</p> : null}
            <CoordinatePicker latitude={v.latitude} longitude={v.longitude} onChange={(lat, lng) => { setF("latitude", lat.toFixed(6)); setF("longitude", lng.toFixed(6)); }} />
            {edit ? <div className="rounded-xl bg-sand-100/70 p-3 text-sm text-ink-600"><p className="font-semibold text-lagoon-900">Read-only info</p><p>Rating and review count are calculated from reviews.</p></div> : null}
          </Card>
        </div>
        {prev ? (
          <div className="sticky top-20 h-fit">
            <Card className="p-4 sm:p-5">
              <p className="mb-3 text-sm font-semibold text-lagoon-900">Live preview</p>
              <DestinationFormPreview values={pvals} />
            </Card>
          </div>
        ) : null}
      </div>
      <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-lg ring-1 ring-line backdrop-blur">
        <Button type="submit" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : null}{saving ? "Saving…" : edit ? "Save changes" : "Create destination"}</Button>
        <Button type="button" variant="secondary" onClick={() => nav("/admin/destinations")} disabled={saving}>Cancel</Button>
        <p className="ml-auto text-xs text-ink-600">Unsaved changes will be lost if you navigate away.</p>
      </div>
    </form>
  );
}
