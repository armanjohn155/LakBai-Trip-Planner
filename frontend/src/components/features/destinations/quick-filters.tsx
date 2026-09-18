import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { DestinationFilters, Region } from "@/lib/types";

const REGIONS: Region[] = ["Metro Cebu", "North Cebu", "South Cebu"];

interface QuickFiltersProps {
  filters: DestinationFilters;
  categories: string[];
  onChange: (filters: DestinationFilters) => void;
}

export function QuickFilters({ filters, categories, onChange }: QuickFiltersProps) {
  const update = (patch: Partial<DestinationFilters>) => onChange({ ...filters, ...patch });

  const clear = () => onChange({ category: "", region: "", search: "", min_price: "", max_price: "" });

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
    >
      <Input
        name="search"
        label="Search"
        placeholder="Kawasan, Oslob…"
        value={filters.search ?? ""}
        onChange={(event) => update({ search: event.target.value })}
      />
      <Select
        name="region"
        label="Region"
        emptyLabel="Any region"
        value={filters.region ?? ""}
        onChange={(event) => update({ region: event.target.value as Region | "" })}
        options={REGIONS.map((region) => ({ value: region, label: region }))}
      />
      <Select
        name="category"
        label="Category"
        emptyLabel="Any category"
        value={filters.category ?? ""}
        onChange={(event) => update({ category: event.target.value })}
        options={categories.map((category) => ({ value: category, label: category }))}
      />
      <div className="flex items-end gap-2">
        <Input
          name="min_price"
          label="Min ₱"
          type="number"
          min={0}
          placeholder="0"
          value={filters.min_price ?? ""}
          onChange={(event) => update({ min_price: event.target.value === "" ? "" : Number(event.target.value) })}
        />
        <Input
          name="max_price"
          label="Max ₱"
          type="number"
          min={0}
          placeholder="any"
          value={filters.max_price ?? ""}
          onChange={(event) => update({ max_price: event.target.value === "" ? "" : Number(event.target.value) })}
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
