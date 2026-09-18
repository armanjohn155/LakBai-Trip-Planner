/* eslint-disable react-refresh/only-export-components */

import { useMemo, useState, type ReactNode } from "react";

import { ChevronIcon, SlidersIcon } from "@/components/icons";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { Destination, ExplorerFilters, PriceTier, SortBy } from "@/lib/types";

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
  { value: "reviews", label: "Most Reviewed" },
  { value: "name", label: "Name A–Z" },
];

export const EMPTY_EXPLORER_FILTERS: ExplorerFilters = {
  categories: [],
  municipalities: [],
  priceTier: "",
  minRating: 0,
  sortBy: "popular",
};

const CATEGORIES = [
  "Beach",
  "Waterfall",
  "Mountains & Hiking",
  "Historical & Cultural",
  "Religious Sites",
  "Food & Restaurants",
  "Diving & Water Activities",
  "Nature & Eco-Tourism",
  "Islands",
];

const PRICE_TIERS: { value: PriceTier; label: string }[] = [
  { value: "", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "1", label: "₱" },
  { value: "2", label: "₱₱" },
  { value: "3", label: "₱₱₱" },
];

const RATING_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Any rating" },
  { value: "4.5", label: "4.5+ stars" },
  { value: "4.0", label: "4.0+ stars" },
  { value: "3.5", label: "3.5+ stars" },
];

interface DestinationFiltersProps {
  filters: ExplorerFilters;
  allDestinations: Destination[];
  onFiltersChange: (filters: ExplorerFilters) => void;
}

export function DestinationFilters({ filters, allDestinations, onFiltersChange }: DestinationFiltersProps) {
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const destination of allDestinations) {
      counts.set(destination.category, (counts.get(destination.category) ?? 0) + 1);
    }
    return counts;
  }, [allDestinations]);

  const municipalities = useMemo(() => {
    const set = new Set<string>();
    for (const destination of allDestinations) {
      if (destination.municipality) set.add(destination.municipality);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allDestinations]);

  const toggleCategory = (category: string) => {
    onFiltersChange({
      ...filters,
      categories: filters.categories.includes(category)
        ? filters.categories.filter((current) => current !== category)
        : [...filters.categories, category],
    });
  };

  const toggleMunicipality = (municipality: string) => {
    onFiltersChange({
      ...filters,
      municipalities: filters.municipalities.includes(municipality)
        ? filters.municipalities.filter((current) => current !== municipality)
        : [...filters.municipalities, municipality],
    });
  };

  const clearAll = () => onFiltersChange({ ...EMPTY_EXPLORER_FILTERS });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-lagoon-900">
          <SlidersIcon className="h-4 w-4 text-sea-600" />
          Filters
        </h2>
        <button type="button" onClick={clearAll} className="text-xs font-semibold text-sea-600 transition-colors hover:text-sea-500">
          Clear all
        </button>
      </div>

      <FilterGroup title="Categories" defaultOpen>
        <div className="space-y-0.5">
          {CATEGORIES.map((category) => {
            const count = categoryCounts.get(category) ?? 0;
            const checked = filters.categories.includes(category);
            const disabled = count === 0 && !checked;
            return (
              <label
                key={category}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-sand-100",
                  disabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-surf-400"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleCategory(category)}
                />
                <span className="flex-1 leading-tight">{category}</span>
                <span
                  className={cn(
                    "rounded-full bg-sand-100 px-2 py-0.5 text-xs tabular-nums text-ink-600",
                    checked && "bg-surf-400/15 font-semibold text-sea-600",
                  )}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Municipalities" defaultOpen>
        <div className="space-y-0.5">
          {municipalities.map((municipality) => (
            <label key={municipality} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-sand-100">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-surf-400"
                checked={filters.municipalities.includes(municipality)}
                onChange={() => toggleMunicipality(municipality)}
              />
              <span>{municipality}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Price Range" defaultOpen>
        <RadioGroup options={PRICE_TIERS} value={filters.priceTier} onChange={(tier) => onFiltersChange({ ...filters, priceTier: tier as PriceTier })} />
      </FilterGroup>

      <FilterGroup title="Rating" defaultOpen={false}>
        <RadioGroup options={RATING_OPTIONS} value={String(filters.minRating)} onChange={(rating) => onFiltersChange({ ...filters, minRating: Number(rating) })} />
      </FilterGroup>

      <FilterGroup title="Sort By" defaultOpen>
        <Select
          className="h-10"
          aria-label="Sort by"
          value={filters.sortBy}
          onChange={(event) => onFiltersChange({ ...filters, sortBy: event.target.value as SortBy })}
          options={SORT_OPTIONS}
        />
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-frost rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between font-display text-base font-semibold text-lagoon-900"
      >
        {title}
        <ChevronIcon className={cn("h-4 w-4 text-ink-600 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function RadioGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-0.5">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-sand-100">
          <input type="radio" className="h-4 w-4 accent-surf-400" checked={value === option.value} onChange={() => onChange(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}