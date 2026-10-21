import { useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { CoordinatePicker } from "@/components/features/admin/coordinate-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { FieldHint, Input, Select } from "@/components/ui/input";
import {
  apiError,
  apiFieldErrors,
  createAdminDestination,
  updateAdminDestination,
} from "@/lib/api";
import {
  CEBU_BOUNDS,
  DESTINATION_CATEGORIES,
  DESTINATION_REGIONS,
  MUNICIPALITY_SUGGESTIONS,
} from "@/lib/destination-constants";
import type { Destination } from "@/lib/types";

interface DestinationFormValues {
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
}

const emptyValues: DestinationFormValues = {
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
};

const valuesFromDestination = (destination?: Destination): DestinationFormValues =>
  destination
    ? {
        name: destination.name,
        description: destination.description,
        category: destination.category,
        region: destination.region,
        municipality: destination.municipality ?? "",
        latitude: destination.latitude,
        longitude: destination.longitude,
        estimated_cost: destination.estimated_cost ?? "",
        best_time_to_visit: destination.best_time_to_visit ?? "",
        tips: destination.tips ?? "",
      }
    : emptyValues;

const textareaClass =
  "min-h-24 w-full rounded-xl bg-white/70 px-4 py-3 text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400 backdrop-blur-sm";

export function DestinationForm({ destination }: { destination?: Destination }) {
  const navigate = useNavigate();
  const isEditing = Boolean(destination);
  const [values, setValues] = useState<DestinationFormValues>(() => valuesFromDestination(destination));
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(destination?.image_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = (field: keyof DestinationFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const selectImage = (file: File | null) => {
    setImage(file);
    if (!file) {
      setPreview(destination?.image_url ?? null);
      return;
    }
    setPreview(URL.createObjectURL(file));
  };

  const outsideCebu = useMemo(() => {
    const lat = Number(values.latitude);
    const lng = Number(values.longitude);
    if (values.latitude === "" || values.longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    return lat < CEBU_BOUNDS.minLat || lat > CEBU_BOUNDS.maxLat || lng < CEBU_BOUNDS.minLng || lng > CEBU_BOUNDS.maxLng;
  }, [values.latitude, values.longitude]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);

    const formData = new FormData();
    (Object.keys(values) as (keyof DestinationFormValues)[]).forEach((key) => {
      formData.append(key, values[key]);
    });
    if (image) {
      formData.append("image", image);
    }

    try {
      if (destination) {
        await updateAdminDestination(destination.id, formData);
      } else {
        await createAdminDestination(formData);
      }

      navigate("/admin/destinations", {
        replace: true,
        state: { toast: isEditing ? `${values.name} was updated.` : `${values.name} was added.` },
      });
    } catch (error) {
      const fieldErrors = apiFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setFormError(apiError(error));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">
          {isEditing ? `Edit ${destination?.name}` : "New destination"}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {isEditing ? "Update the details travelers see." : "Add a place to the shared destination library."}
        </p>
      </div>

      {formError ? <InlineError message={formError} /> : null}

      <Card className="space-y-5 p-5 sm:p-6">
        <Input
          label="Name"
          name="name"
          value={values.name}
          onChange={(event) => setField("name", event.target.value)}
          error={errors.name}
          placeholder="Kawasan Falls"
          required
        />

        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-semibold text-ink-900">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            className={textareaClass}
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
            placeholder="What makes this place worth the trip?"
            required
          />
          {errors.description ? <p className="text-sm text-red-600">{errors.description}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            name="category"
            value={values.category}
            onChange={(event) => setField("category", event.target.value)}
            error={errors.category}
            emptyLabel="Choose a category"
            options={DESTINATION_CATEGORIES.map((category) => ({ value: category, label: category }))}
            required
          />
          <Select
            label="Region"
            name="region"
            value={values.region}
            onChange={(event) => setField("region", event.target.value)}
            error={errors.region}
            emptyLabel="Choose a region"
            options={DESTINATION_REGIONS.map((region) => ({ value: region, label: region }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Input
            label="Municipality"
            name="municipality"
            value={values.municipality}
            onChange={(event) => setField("municipality", event.target.value)}
            error={errors.municipality}
            placeholder="Badian"
            list="municipality-suggestions"
          />
          <datalist id="municipality-suggestions">
            {MUNICIPALITY_SUGGESTIONS.map((municipality) => (
              <option key={municipality} value={municipality} />
            ))}
          </datalist>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Latitude"
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            value={values.latitude}
            onChange={(event) => setField("latitude", event.target.value)}
            error={errors.latitude}
            placeholder="9.8019444"
            required
          />
          <Input
            label="Longitude"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            value={values.longitude}
            onChange={(event) => setField("longitude", event.target.value)}
            error={errors.longitude}
            placeholder="123.3738889"
            required
          />
        </div>

        {outsideCebu ? (
          <p className="rounded-xl bg-mango-400/20 px-4 py-3 text-sm text-lagoon-900">
            These coordinates are outside Cebu. Double-check the pin before saving.
          </p>
        ) : null}

        <CoordinatePicker
          latitude={values.latitude}
          longitude={values.longitude}
          onChange={(latitude, longitude) => {
            setField("latitude", latitude.toFixed(6));
            setField("longitude", longitude.toFixed(6));
          }}
        />
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Estimated cost (₱)"
            name="estimated_cost"
            type="number"
            min={0}
            step="0.01"
            value={values.estimated_cost}
            onChange={(event) => setField("estimated_cost", event.target.value)}
            error={errors.estimated_cost}
            placeholder="500"
          />
          <Input
            label="Best time to visit"
            name="best_time_to_visit"
            value={values.best_time_to_visit}
            onChange={(event) => setField("best_time_to_visit", event.target.value)}
            error={errors.best_time_to_visit}
            placeholder="Early morning, dry season"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="tips" className="block text-sm font-semibold text-ink-900">
            Tips
          </label>
          <textarea
            id="tips"
            name="tips"
            className={textareaClass}
            value={values.tips}
            onChange={(event) => setField("tips", event.target.value)}
            placeholder="Bring a dry bag, cash for entrance fees…"
          />
          {errors.tips ? <p className="text-sm text-red-600">{errors.tips}</p> : null}
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-sm font-semibold text-ink-900">Photo</p>
          <FieldHint>JPG, PNG, or WebP up to 2 MB. Uploading a new photo replaces the old one.</FieldHint>
        </div>

        {preview ? (
          <img
            src={preview}
            alt={values.name || "Destination preview"}
            className="h-40 w-full rounded-xl object-cover ring-1 ring-inset ring-line"
          />
        ) : null}

        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-sand-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-lagoon-900 hover:file:bg-sand-50"
        />
        {errors.image ? <p className="text-sm text-red-600">{errors.image}</p> : null}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : null}
          {saving ? "Saving…" : isEditing ? "Save changes" : "Create destination"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate("/admin/destinations")} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
