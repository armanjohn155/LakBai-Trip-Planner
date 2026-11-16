import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DESTINATION_REGIONS } from "@/lib/destination-constants";
import type { DestinationFilters, Region } from "@/lib/types";

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
      className="glass space-y-3 rounded-2xl p-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 sm:p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
    >
      <Input
        name="search"
        label="Search"
        placeholder="Search destinations…"
        value={filters.search ?? ""}
        onChange={(event) => update({ search: event.target.value })}
      />

      <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:hidden" role="group" aria-label="Filter by category">
        <CategoryChip active={!filters.category} label="All" onClick={() => update({ category: "" })} />
        {categories.map((category) => (
          <CategoryChip key={category} active={filters.category === category} label={category} onClick={() => update({ category })} />
        ))}
      </div>

      <div className="hidden sm:block">
        <Select
          name="region"
          label="Region"
          emptyLabel="Any region"
          value={filters.region ?? ""}
          onChange={(event) => update({ region: event.target.value as Region | "" })}
          options={DESTINATION_REGIONS.map((region) => ({ value: region, label: region }))}
        />
      </div>
      <div className="hidden sm:block">
        <Select
          name="category"
          label="Category"
          emptyLabel="Any category"
          value={filters.category ?? ""}
          onChange={(event) => update({ category: event.target.value })}
          options={categories.map((category) => ({ value: category, label: category }))}
        />
      </div>
      <div className="hidden items-end gap-2 sm:flex">
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
      <div className="hidden items-end gap-2 sm:flex">
        <Button type="submit">Filter</Button>
        <Button type="button" variant="secondary" onClick={clear}>Clear</Button>
      </div>

      <details className="sm:hidden">
        <summary className="cursor-pointer list-none text-xs font-semibold text-sea-700">More filters</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Select
            name="mobile-region"
            label="Region"
            emptyLabel="Any region"
            value={filters.region ?? ""}
            onChange={(event) => update({ region: event.target.value as Region | "" })}
            options={DESTINATION_REGIONS.map((region) => ({ value: region, label: region }))}
          />
          <Input
            name="mobile-min-price"
            label="Min ₱"
            type="number"
            min={0}
            placeholder="0"
            value={filters.min_price ?? ""}
            onChange={(event) => update({ min_price: event.target.value === "" ? "" : Number(event.target.value) })}
          />
          <Input
            name="mobile-max-price"
            label="Max ₱"
            type="number"
            min={0}
            placeholder="Any"
            value={filters.max_price ?? ""}
            onChange={(event) => update({ max_price: event.target.value === "" ? "" : Number(event.target.value) })}
          />
          <Button type="button" variant="secondary" className="self-end" onClick={clear}>Clear filters</Button>
        </div>
      </details>
    </form>
  );
}

function CategoryChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`snap-start whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${active ? "bg-surf-400 text-white" : "bg-white text-ink-800 ring-1 ring-inset ring-line hover:bg-sand-50"}`}
    >
      {label}
    </button>
  );
}
