import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { DestinationFilters, Region } from "@/lib/types";

const REGIONS: Region[] = ["Metro Cebu", "North Cebu", "South Cebu"];

const CATEGORIES = ["Beach", "Waterfall", "Island", "Heritage", "Food", "Viewpoint"];

interface QuickFiltersProps {
  filters: DestinationFilters;
  onChange: (filters: DestinationFilters) => void;
}

export function QuickFilters({ filters, onChange }: QuickFiltersProps) {
  const [draft, setDraft] = useState<DestinationFilters>(filters);

  const apply = (patch: Partial<DestinationFilters>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onChange(draft);
  };

  const clear = () => {
    const empty: DestinationFilters = { category: "", region: "", search: "", min_price: "", max_price: "" };
    setDraft(empty);
    onChange(empty);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <Input
        name="search"
        label="Search"
        placeholder="Kawasan, Oslob…"
        value={draft.search ?? ""}
        onChange={(event) => apply({ search: event.target.value })}
      />
      <Select
        name="region"
        label="Region"
        emptyLabel="Any region"
        value={draft.region ?? ""}
        onChange={(event) => apply({ region: event.target.value as Region | "" })}
        options={REGIONS.map((region) => ({ value: region, label: region }))}
      />
      <Select
        name="category"
        label="Category"
        emptyLabel="Any category"
        value={draft.category ?? ""}
        onChange={(event) => apply({ category: event.target.value })}
        options={CATEGORIES.map((category) => ({ value: category, label: category }))}
      />
      <div className="flex items-end gap-2">
        <Input
          name="min_price"
          label="Min ₱"
          type="number"
          min={0}
          placeholder="0"
          value={draft.min_price ?? ""}
          onChange={(event) => apply({ min_price: event.target.value === "" ? "" : Number(event.target.value) })}
        />
        <Input
          name="max_price"
          label="Max ₱"
          type="number"
          min={0}
          placeholder="any"
          value={draft.max_price ?? ""}
          onChange={(event) => apply({ max_price: event.target.value === "" ? "" : Number(event.target.value) })}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit">Filter</Button>
        <Button type="button" variant="secondary" onClick={clear}>
          Clear
        </Button>
      </div>
    </form>
  );
}