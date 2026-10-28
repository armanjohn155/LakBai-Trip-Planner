import { useState } from "react";

import { XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface TagInputProps {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  error?: string;
  hint?: string;
}

export function TagInput({ label, value, onChange, placeholder, max = 12, maxLength = 40, error, hint }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const cleaned = tag.trim().replace(/,/g, "");
    if (!cleaned) return;
    if (value.includes(cleaned)) {
      setInput("");
      return;
    }
    if (value.length >= max) {
      setInput("");
      return;
    }
    if (cleaned.length > maxLength) {
      return;
    }
    onChange([...value, cleaned]);
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {label ? <label className="block text-sm font-semibold text-ink-900">{label}</label> : null}
      <div
        className={cn(
          "flex min-h-[52px] w-full flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-inset ring-line backdrop-blur-sm",
          error && "ring-red-400",
        )}
      >
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-lagoon-900 ring-1 ring-inset ring-line"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="rounded-full p-0.5 hover:bg-white/70"
              aria-label={`Remove ${tag}`}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            } else if (e.key === "Backspace" && input === "" && value.length > 0) {
              removeTag(value.length - 1);
            }
          }}
          onBlur={() => addTag(input)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent px-1 py-1 text-sm text-ink-900 placeholder:text-ink-600/50 focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-ink-600">
        <span>{hint}</span>
        <span>
          {value.length}/{max}
        </span>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
