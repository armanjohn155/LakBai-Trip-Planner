import { useState } from "react";

import { XIcon, GridIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export interface GalleryItem {
  id: string;
  file?: File;
  url?: string;
  preview?: string;
}

interface GalleryUploaderProps {
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  max?: number;
  error?: string;
}

export function GalleryUploader({ items, onChange, max = 8, error }: GalleryUploaderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: GalleryItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) continue;
      if (file.size > 2 * 1024 * 1024) continue;
      newItems.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }
    const merged = [...items, ...newItems].slice(0, max);
    onChange(merged);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const setCover = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    onChange(next);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-900">Photos</p>
          <p className="text-xs text-ink-600">Up to {max} images, JPG/PNG/WebP, max 2 MB each</p>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className="inline-flex items-center rounded-full bg-sand-100 px-3 py-1.5 text-xs font-semibold text-lagoon-900 ring-1 ring-inset ring-line hover:bg-sand-50">
            Add photos
          </span>
        </label>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => {
            const src = item.preview || item.url;
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex === null) return;
                  reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                className={cn(
                  "group relative overflow-hidden rounded-xl ring-1 ring-inset ring-line",
                  index === 0 && "ring-2 ring-sea-500",
                )}
              >
                {src ? <img src={src} alt="Destination" className="h-32 w-full object-cover" /> : null}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-sea-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Cover
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => setCover(index)} className="text-[10px] font-semibold text-white">
                    Set as cover
                  </button>
                  <button type="button" onClick={() => removeItem(index)} className="rounded-full p-1 text-white hover:bg-white/20">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white">
                  <GridIcon className="h-3 w-3" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-600">
          No photos yet
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
