import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { ChevronIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { OptionIcon } from "@/components/features/destinations/option-icon";
import { Spinner } from "@/components/ui/feedback";
import { apiError, apiFieldErrors, createAdminDestinationOption, type DestinationOption, type DestinationOptionKind } from "@/lib/api";
import { cn } from "@/lib/cn";
import { invalidateDestinationOptions } from "@/lib/destination-options";

interface OptionComboboxProps {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  kind: DestinationOptionKind;
  options: DestinationOption[];
  onChange: (value: string) => void;
  onCreated?: (option: DestinationOption) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

export function OptionCombobox({
  label,
  name,
  value,
  placeholder,
  kind,
  options,
  onChange,
  onCreated,
  error,
  required,
  className,
}: OptionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();

  const selected = options.find((option) => option.name === value);
  const isHiddenValue = value !== "" && selected === undefined;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.name.toLowerCase().includes(needle));
  }, [options, query]);

  const exactMatch = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle !== "" && options.some((option) => option.name.toLowerCase() === needle);
  }, [options, query]);

  const canCreate = query.trim() !== "" && !exactMatch;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const openList = () => {
    setQuery("");
    setCreateError(null);
    const selectedIndex = options.findIndex((option) => option.name === value);
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const closeList = () => {
    setOpen(false);
    setQuery("");
    setCreateError(null);
  };

  const select = (option: DestinationOption) => {
    onChange(option.name);
    closeList();
  };

  const create = async () => {
    const name = query.trim();
    if (name === "" || creating) return;

    setCreating(true);
    setCreateError(null);

    try {
      const created = await createAdminDestinationOption(kind, { name });
      invalidateDestinationOptions();
      onChange(created.name);
      onCreated?.(created);
      closeList();
    } catch (err) {
      const fields = apiFieldErrors(err);
      setCreateError(fields.name ?? apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlighted(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlighted(Math.max(filtered.length - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlighted];
      if (option) {
        select(option);
      } else if (canCreate) {
        void create();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeList();
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label id={labelId} htmlFor={`${name}-trigger`} className="block text-sm font-semibold text-ink-900">
        {label}
      </label>

      <div className="relative">
        <button
          id={`${name}-trigger`}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          aria-required={required}
          onClick={() => (open ? closeList() : openList())}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 rounded-xl bg-white/70 px-4 text-left text-base text-ink-900 ring-1 ring-inset ring-line backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-surf-400",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", value === "" && "text-ink-600/50")}>{value || placeholder}</span>
          {isHiddenValue ? (
            <span className="shrink-0 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">(hidden)</span>
          ) : null}
          <ChevronIcon className={cn("h-4 w-4 shrink-0 text-ink-500 transition-transform", open && "rotate-180")} />
        </button>

        {open ? (
          <div className="absolute z-[1100] mt-1 w-full overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-line">
            <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
              <SearchIcon className="h-4 w-4 shrink-0 text-ink-500" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={onKeyDown}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={filtered[highlighted] ? `${listId}-${highlighted}` : undefined}
                placeholder={`Search ${kind === "categories" ? "categories" : "regions"}…`}
                className="h-8 w-full min-w-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-600/50 focus:outline-none"
              />
            </div>

            <ul id={listId} role="listbox" aria-labelledby={labelId} className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-ink-600">No matches.</li>
              ) : (
                filtered.map((option, index) => {
                  const active = index === highlighted;
                  return (
                    <li
                      key={option.slug}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={option.name === value}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => select(option)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-900",
                        active && "bg-surf-400/15 text-sea-600",
                      )}
                    >
                      {option.color ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: option.color }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <OptionIcon icon={option.icon} className="h-4 w-4 shrink-0 text-sea-600" />
                      <span className="min-w-0 flex-1 truncate">{option.name}</span>
                      {option.name === value ? <span className="text-xs font-semibold">Selected</span> : null}
                    </li>
                  );
                })
              )}
            </ul>

            {canCreate ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void create()}
                disabled={creating}
                className="flex w-full items-center gap-2 border-t border-line/60 px-3 py-2.5 text-left text-sm font-semibold text-sea-600 hover:bg-sand-50 disabled:opacity-60"
              >
                {creating ? <Spinner className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                {creating ? "Adding…" : `Add "${query.trim()}"`}
              </button>
            ) : null}

            {createError ? (
              <p role="alert" className="border-t border-line/60 bg-red-50 px-3 py-2 text-xs text-red-700">
                {createError}
              </p>
            ) : null}

            <div className="border-t border-line/60 px-3 py-2 text-xs">
              <Link
                to="/admin/destination-options"
                onClick={closeList}
                className="font-semibold text-sea-600 hover:underline"
              >
                Manage categories and regions
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
