import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <Label htmlFor={inputId}>{label}</Label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-xl bg-white px-4 text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:ring-2 focus:ring-surf-400 focus:outline-none",
          className,
        )}
        {...props}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-semibold text-ink-900", className)} {...props}>
      {children}
    </label>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-600">{children}</p>;
}

export function Select({ className, label, error, id, options, emptyLabel, ...props }: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      <select
        id={selectId}
        className={cn(
          "h-11 w-full appearance-none rounded-xl bg-white px-4 text-ink-900 ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none",
          className,
        )}
        {...props}
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}