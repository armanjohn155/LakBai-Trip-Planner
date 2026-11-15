import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripIcon,
  MapIcon,
  PencilIcon,
  StarIcon,
  XIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { apiError, deleteTripPhoto, reorderTripPhotos, updateTripPhoto, uploadTripPhoto } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { RecapStop, TripPhoto } from "@/lib/types";

import { formatRecapDate, resolveRecapMediaUrl } from "./recap-utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface UploadJob {
  key: string;
  name: string;
  progress: number;
  error: string | null;
  done: boolean;
}

interface RecapGalleryProps {
  itineraryId: number;
  photos: TripPhoto[];
  stops: RecapStop[];
  coverPhotoId: number | null;
  canUpload: boolean;
  isOwner: boolean;
  currentUserId?: number | null;
  onChanged: () => Promise<void> | void;
  onSetCover: (photoId: number) => Promise<void> | void;
  onNotify?: (message: string) => void;
  className?: string;
  /**
   * Optional controlled lightbox. When provided, the parent owns which photo
   * is open so a timeline thumbnail or map pin can open the gallery.
   */
  openPhotoId?: number | null;
  onOpenPhotoChange?: (photoId: number | null) => void;
}

export function RecapGallery({
  itineraryId,
  photos,
  stops,
  coverPhotoId,
  canUpload,
  isOwner,
  currentUserId,
  onChanged,
  onSetCover,
  onNotify,
  className,
  openPhotoId,
  onOpenPhotoChange,
}: RecapGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [linkedStop, setLinkedStop] = useState<string>("");
  const [upgradingCover, setUpgradingCover] = useState(false);
  const [internalLightboxId, setInternalLightboxId] = useState<number | null>(null);
  const [hidingId, setHidingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const controlled = openPhotoId !== undefined;
  const lightboxId = controlled ? openPhotoId : internalLightboxId;
  const setLightboxId = useCallback((next: number | null) => {
    if (controlled) {
      onOpenPhotoChange?.(next);
    }
    setInternalLightboxId(next);
  }, [controlled, onOpenPhotoChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = useMemo(() => [...photos].sort((a, b) => a.position - b.position || a.id - b.id), [photos]);
  const visiblePhotos = useMemo(
    () => ordered.filter((photo) => isOwner || photo.user?.id === undefined || photo.user.id === currentUserId || !photo.is_hidden),
    [ordered, isOwner, currentUserId],
  );
  const lightboxIndex = lightboxId === null ? -1 : visiblePhotos.findIndex((photo) => photo.id === lightboxId);
  const lightboxPhoto = lightboxIndex >= 0 ? visiblePhotos[lightboxIndex] : null;

  useEffect(() => {
    if (!lightboxPhoto && lightboxId !== null) {
      setLightboxId(null);
    }
  }, [lightboxPhoto, lightboxId, setLightboxId]);

  const uploadsBusy = jobs.some((job) => !job.done && job.error === null);
  const canEditPhoto = (photo: TripPhoto) => isOwner || (photo.user?.id ?? -1) === currentUserId;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    const queued: Array<{ file: File; key: string }> = [];
    const rejected: UploadJob[] = [];

    for (const [index, file] of incoming.entries()) {
      const key = `${Date.now()}-${index}-${file.name}`;
      if (!ACCEPTED.includes(file.type)) {
        rejected.push({ key, name: file.name, progress: 0, error: "Only JPG, PNG or WebP photos are allowed.", done: true });
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push({ key, name: file.name, progress: 0, error: "Each photo must be 5 MB or smaller.", done: true });
        continue;
      }
      queued.push({ file, key });
    }

    setJobs((current) => [
      ...current,
      ...queued.map(({ file, key }) => ({ key, name: file.name, progress: 0, error: null, done: false })),
      ...rejected,
    ]);

    for (const { file, key } of queued) {
      try {
        await uploadTripPhoto(
          itineraryId,
          file,
          { itinerary_item_id: linkedStop ? Number(linkedStop) : null },
          (progress) => setJobs((current) => current.map((job) => (job.key === key ? { ...job, progress } : job))),
        );
        setJobs((current) => current.map((job) => (job.key === key ? { ...job, progress: 100, done: true } : job)));
      } catch (error) {
        setJobs((current) =>
          current.map((job) => (job.key === key ? { ...job, error: apiError(error), done: true } : job)),
        );
      }
    }

    if (queued.length > 0) {
      await onChanged();
      onNotify?.(queued.length === 1 ? "Photo added to your recap." : `${queued.length} photos added.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = ordered.map((photo) => photo.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;

    try {
      await reorderTripPhotos(itineraryId, arrayMove(ids, from, to));
      await onChanged();
    } catch (error) {
      onNotify?.(apiError(error));
    }
  };

  const handleCaption = async (photo: TripPhoto, caption: string) => {
    try {
      await updateTripPhoto(itineraryId, photo.id, { caption: caption.trim() || null });
      await onChanged();
      onNotify?.("Caption saved.");
    } catch (error) {
      onNotify?.(apiError(error));
    }
  };

  const handleHidden = async (photo: TripPhoto, hidden: boolean) => {
    setHidingId(photo.id);
    try {
      await updateTripPhoto(itineraryId, photo.id, { is_hidden: hidden });
      await onChanged();
      onNotify?.(hidden ? "Photo hidden from the public recap." : "Photo is visible again.");
    } catch (error) {
      onNotify?.(apiError(error));
    } finally {
      setHidingId(null);
    }
  };

  const handleDelete = async (photo: TripPhoto) => {
    if (!window.confirm("Remove this photo from the recap? This cannot be undone.")) return;
    setDeletingId(photo.id);
    try {
      await deleteTripPhoto(itineraryId, photo.id);
      setLightboxId(null);
      await onChanged();
      onNotify?.("Photo removed.");
    } catch (error) {
      onNotify?.(apiError(error));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetCover = async (photo: TripPhoto) => {
    setUpgradingCover(true);
    try {
      await onSetCover(photo.id);
      onNotify?.("Cover photo updated.");
    } catch (error) {
      onNotify?.(apiError(error));
    } finally {
      setUpgradingCover(false);
    }
  };

  const moveLightbox = (direction: -1 | 1) => {
    if (lightboxIndex === -1) return;
    const next = visiblePhotos[(lightboxIndex + direction + visiblePhotos.length) % visiblePhotos.length];
    if (next) setLightboxId(next.id);
  };

  useEffect(() => {
    if (lightboxId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxId(null);
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxId, lightboxIndex, visiblePhotos.length]);

  const stopName = (stopId: number | null | undefined) =>
    stopId ? stops.find((stop) => stop.id === stopId)?.title ?? null : null;

  return (
    <section className={cn("space-y-4", className)} id="recap-gallery">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-lagoon-900">Photo memories</h2>
          <p className="mt-0.5 text-sm text-ink-600">
            {ordered.length === 0
              ? canUpload
                ? "Add the shots you actually want to remember."
                : "No photos were added to this recap."
              : `${ordered.length} ${ordered.length === 1 ? "photo" : "photos"}${canUpload ? " · drag to reorder" : ""}`}
          </p>
        </div>

        {canUpload ? (
          <div className="flex flex-wrap items-end gap-2">
            {stops.length > 0 ? (
              <Select
                aria-label="Link next uploads to a stop"
                value={linkedStop}
                onChange={(event) => setLinkedStop(event.target.value)}
                emptyLabel="No stop"
                options={stops.map((stop) => ({ value: String(stop.id), label: `Day ${stop.day_number} · ${stop.title}` }))}
                className="h-9 min-w-44 text-xs"
              />
            ) : null}
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadsBusy}>
              {uploadsBusy ? <Spinner className="h-4 w-4" /> : <CameraIcon className="h-4 w-4" />}
              {uploadsBusy ? "Uploading..." : "Add photos"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </div>
        ) : null}
      </div>

      {jobs.length > 0 ? (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li
              key={job.key}
              className={cn(
                "rounded-xl bg-white/70 px-3 py-2 text-xs ring-1 ring-inset ring-line/60",
                job.error && "bg-red-50 ring-red-200",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-ink-800">{job.name}</span>
                {job.error ? (
                  <span className="shrink-0 font-semibold text-red-700">{job.error}</span>
                ) : job.done ? (
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-sea-600">
                    <CheckIcon className="h-3.5 w-3.5" /> Uploaded
                  </span>
                ) : (
                  <span className="shrink-0 text-ink-600">{job.progress}%</span>
                )}
              </div>
              {!job.done && !job.error ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-200">
                  <div className="h-full rounded-full bg-surf-400 transition-all" style={{ width: `${job.progress}%` }} />
                </div>
              ) : null}
            </li>
          ))}
          <li className="text-right">
            <button
              type="button"
              onClick={() => setJobs([])}
              className="text-[11px] font-semibold text-ink-600 hover:text-ink-900"
            >
              Clear upload list
            </button>
          </li>
        </ul>
      ) : null}

      {visiblePhotos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <CameraIcon className="h-7 w-7 text-ink-500" />
          <p className="font-display text-xl font-medium text-lagoon-900">No photos yet</p>
          <p className="max-w-sm text-sm text-ink-600">
            {canUpload ? "The best recap is the one with your own photos. Add up to 20 per traveller." : "The owner kept the gallery private."}
          </p>
        </div>
      ) : canUpload ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
          <SortableContext items={ordered.map((photo) => photo.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ordered.map((photo, index) => (
                <SortablePhoto
                  key={photo.id}
                  photo={photo}
                  index={index}
                  isCover={photo.id === coverPhotoId}
                  onOpen={() => setLightboxId(photo.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo) => (
            <li key={photo.id}>
              <PhotoTile photo={photo} isCover={photo.id === coverPhotoId} onOpen={() => setLightboxId(photo.id)} />
            </li>
          ))}
        </ul>
      )}

      {lightboxPhoto ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-lagoon-950/90 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Trip photo"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close photo"
            onClick={() => setLightboxId(null)}
          />
          <div className="relative z-10 grid max-h-full w-full max-w-5xl gap-4 overflow-y-auto rounded-2xl bg-lagoon-950/95 p-3 text-sand-50 shadow-2xl sm:grid-cols-[minmax(0,1fr)_18rem] sm:p-4">
            <div className="relative flex min-h-[16rem] items-center justify-center overflow-hidden rounded-xl bg-black/40">
              <img
                src={resolveRecapMediaUrl(lightboxPhoto.url) ?? undefined}
                alt={lightboxPhoto.caption ?? "Trip photo"}
                className="max-h-[70vh] w-full object-contain"
              />
              {visiblePhotos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => moveLightbox(-1)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-lagoon-950/70 p-2 text-sand-50 hover:bg-lagoon-900"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLightbox(1)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-lagoon-950/70 p-2 text-sand-50 hover:bg-lagoon-900"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sand-50/60">
                    Photo {lightboxIndex + 1} of {visiblePhotos.length}
                  </p>
                  {lightboxPhoto.user?.name ? (
                    <p className="mt-0.5 text-xs text-sand-50/70">By {lightboxPhoto.user.name}</p>
                  ) : null}
                  {formatRecapDate(lightboxPhoto.taken_at) ? (
                    <p className="text-xs text-sand-50/70">{formatRecapDate(lightboxPhoto.taken_at)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxId(null)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-sand-50/80 hover:bg-white/10 hover:text-white"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <CaptionEditor
                key={lightboxPhoto.id}
                caption={lightboxPhoto.caption}
                readOnly={!canEditPhoto(lightboxPhoto)}
                onSave={(caption) => handleCaption(lightboxPhoto, caption)}
              />

              {stopName(lightboxPhoto.itinerary_item_id) ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-sand-50/75">
                  <MapIcon className="h-3.5 w-3.5" />
                  {stopName(lightboxPhoto.itinerary_item_id)}
                </p>
              ) : null}

              {canEditPhoto(lightboxPhoto) ? (
                <div className="mt-auto flex flex-wrap gap-2">
                  {lightboxPhoto.id !== coverPhotoId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ring-1 ring-inset ring-white/20"
                      disabled={upgradingCover}
                      onClick={() => void handleSetCover(lightboxPhoto)}
                    >
                      <StarIcon className="h-3.5 w-3.5" />
                      Set cover
                    </Button>
                  ) : (
                    <Badge tone="mango">Cover photo</Badge>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="ring-1 ring-inset ring-white/20"
                    disabled={hidingId === lightboxPhoto.id}
                    onClick={() => void handleHidden(lightboxPhoto, !lightboxPhoto.is_hidden)}
                  >
                    {lightboxPhoto.is_hidden ? "Show on public page" : "Hide from public page"}
                  </Button>

                  <Button
                    size="sm"
                    variant="danger"
                    className="ring-1 ring-inset ring-red-300/30"
                    disabled={deletingId === lightboxPhoto.id}
                    onClick={() => void handleDelete(lightboxPhoto)}
                  >
                    {deletingId === lightboxPhoto.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PhotoTile({ photo, isCover, onOpen }: { photo: TripPhoto; isCover: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square w-full overflow-hidden rounded-xl bg-sand-100 text-left ring-1 ring-inset ring-line/60 focus-visible:outline-none"
      aria-label={photo.caption ?? "Open trip photo"}
    >
      <img
        src={resolveRecapMediaUrl(photo.thumbnail_url) ?? undefined}
        alt={photo.caption ?? ""}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1 bg-gradient-to-t from-lagoon-950/75 to-transparent px-2 pb-1.5 pt-4">
        {isCover ? <span className="rounded-full bg-mango-400 px-1.5 py-0.5 text-[9px] font-bold text-lagoon-950">Cover</span> : null}
        {photo.is_hidden ? <span className="rounded-full bg-lagoon-950/80 px-1.5 py-0.5 text-[9px] font-semibold text-sand-50">Hidden</span> : null}
        {photo.caption ? <span className="min-w-0 truncate text-[10px] text-sand-50">{photo.caption}</span> : null}
      </div>
    </button>
  );
}

function SortablePhoto({
  photo,
  index,
  isCover,
  onOpen,
}: {
  photo: TripPhoto;
  index: number;
  isCover: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 40 : undefined };

  return (
    <li ref={setNodeRef} style={style} className={cn("relative", isDragging && "opacity-80 shadow-xl")}>
      <PhotoTile photo={photo} isCover={isCover} onOpen={onOpen} />
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${photo.caption ?? `photo ${index + 1}`}`}
        className="absolute right-1.5 top-1.5 rounded-lg bg-white/85 p-1.5 text-ink-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
      >
        <GripIcon className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function CaptionEditor({
  caption,
  readOnly,
  onSave,
}: {
  caption: string | null;
  readOnly: boolean;
  onSave: (caption: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(caption ?? "");
  const [saving, setSaving] = useState(false);

  if (readOnly) {
    return caption ? <p className="text-sm leading-relaxed text-sand-50/90">{caption}</p> : null;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(caption ?? "");
          setEditing(true);
        }}
        className="group flex items-start gap-1.5 text-left text-sm text-sand-50/90 hover:text-white"
      >
        <span className="line-clamp-3">{caption || "Add a caption"}</span>
        <PencilIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sand-50/50 group-hover:text-white" />
      </button>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void Promise.resolve(onSave(value)).finally(() => {
          setSaving(false);
          setEditing(false);
        });
      }}
    >
      <textarea
        value={value}
        maxLength={200}
        rows={3}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-sand-50 ring-1 ring-inset ring-white/20 placeholder:text-sand-50/40 focus:ring-2 focus:ring-surf-400 focus:outline-none"
        placeholder="What happened here?"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-sand-50/50">{value.length}/200</span>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Spinner className="h-3.5 w-3.5" /> : null}
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
