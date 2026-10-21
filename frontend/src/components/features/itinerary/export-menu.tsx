import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@/components/icons";
import { apiError, downloadItineraryExport } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { ExportFormat, Itinerary } from "@/lib/types";

interface ExportMenuProps {
  itinerary: Itinerary;
  disabled?: boolean;
  onError?: (message: string) => void;
}

const FORMATS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: "pdf", label: "PDF itinerary", hint: "Printable day-by-day plan" },
  { format: "ics", label: "Calendar (.ics)", hint: "Add stops to Google/Apple Calendar" },
  { format: "gpx", label: "GPX route", hint: "Open in a GPS or map app" },
];

export function ExportMenu({ itinerary, disabled = false, onError }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleExport = async (format: ExportFormat) => {
    setBusy(format);
    try {
      const slug = `lakbai-${Math.max(itinerary.day_count, 1)}-day-${itinerary.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
      await downloadItineraryExport(itinerary.id, format, slug);
      setOpen(false);
    } catch (error) {
      onError?.(apiError(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
        <DownloadIcon className="h-4 w-4" />
        Download
      </Button>

      {open ? (
        <div role="menu" className="absolute right-0 z-[1150] mt-2 w-64 overflow-hidden rounded-2xl glass p-1.5 shadow-xl">
          {FORMATS.map((entry) => (
            <button
              key={entry.format}
              type="button"
              role="menuitem"
              disabled={busy !== null}
              onClick={() => void handleExport(entry.format)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-sand-100 disabled:opacity-60",
              )}
            >
              <span className="text-sm font-semibold text-ink-900">{busy === entry.format ? "Preparing…" : entry.label}</span>
              <span className="text-xs text-ink-600">{entry.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
