import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { CheckIcon, GripIcon, PencilIcon, PlusIcon, XIcon } from "@/components/icons";
import { CATEGORY_ICON_KEYS, OptionIcon } from "@/components/features/destinations/option-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  apiError,
  createAdminDestinationOption,
  deleteAdminDestinationOption,
  getAdminDestinationOptions,
  reorderAdminDestinationOptions,
  updateAdminDestinationOption,
  type AdminDestinationOption,
  type DestinationOptionKind,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { invalidateDestinationOptions } from "@/lib/destination-options";

const COLOR_PALETTE = [
  "#0f766e",
  "#0ea5a4",
  "#0369a1",
  "#1d4ed8",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#475569",
  "#111827",
];

const ICON_OPTIONS = [{ value: "", label: "No icon" }, ...CATEGORY_ICON_KEYS.map((key) => ({ value: key, label: key }))];

export default function AdminDestinationOptionsPage() {
  const [tab, setTab] = useState<DestinationOptionKind>("categories");
  const [items, setItems] = useState<AdminDestinationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addName, setAddName] = useState("");
  const [addIcon, setAddIcon] = useState("");
  const [addColor, setAddColor] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminDestinationOption | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async (kind: DestinationOptionKind) => {
    setLoading(true);
    setError(null);

    try {
      setItems(await getAdminDestinationOptions(kind));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab);
  }, [load, tab]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isCategories = tab === "categories";
  const deleteUsage = deleteTarget ? deleteTarget.destinations_count + (deleteTarget.itinerary_items_count ?? 0) : 0;
  const reassignOptions = useMemo(
    () => items.filter((item) => item.id !== deleteTarget?.id),
    [deleteTarget?.id, items],
  );

  const changeTab = (next: DestinationOptionKind) => {
    setTab(next);
    setEditingId(null);
    setAddName("");
    setAddError(null);
    setError(null);
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = addName.trim();

    if (name === "") {
      setAddError(`Enter a ${isCategories ? "category" : "region"} name.`);
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      const created = await createAdminDestinationOption(tab, {
        name,
        ...(isCategories ? { icon: addIcon || null, color: addColor || null } : {}),
      });

      setItems((current) => [...current, created]);
      setAddName("");
      setAddIcon("");
      setAddColor("");
      invalidateDestinationOptions();
      setToast(`${created.name} was added.`);
    } catch (err) {
      setAddError(apiError(err));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: AdminDestinationOption) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditIcon(item.icon ?? "");
    setEditColor(item.color ?? "");
  };

  const saveEdit = async (item: AdminDestinationOption) => {
    const name = editName.trim();

    if (name === "") return;

    setBusyId(item.id);

    try {
      const updated = await updateAdminDestinationOption(tab, item.id, {
        name,
        ...(isCategories ? { icon: editIcon || null, color: editColor || null } : {}),
      });

      setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
      setEditingId(null);
      invalidateDestinationOptions();
      setToast(`${updated.name} was updated.`);
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (item: AdminDestinationOption) => {
    setBusyId(item.id);

    try {
      const updated = await updateAdminDestinationOption(tab, item.id, { is_active: !item.is_active });
      setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
      invalidateDestinationOptions();
      setToast(updated.is_active ? `${updated.name} is visible again.` : `${updated.name} was hidden.`);
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteUsage > 0 && !reassignTo) {
      setDeleteError("Choose an option to move the existing records to.");
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteAdminDestinationOption(tab, deleteTarget.id, reassignTo ? Number(reassignTo) : undefined);
      setDeleteTarget(null);
      setReassignTo("");
      invalidateDestinationOptions();
      await load(tab);
      setToast(`${deleteTarget.name} was deleted.`);
    } catch (err) {
      setDeleteError(apiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    try {
      await reorderAdminDestinationOptions(
        tab,
        next.map((item, index) => ({ id: item.id, sort_order: index })),
      );
      invalidateDestinationOptions();
      setToast("Order saved.");
    } catch (err) {
      setToast(apiError(err));
      await load(tab);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">Categories and regions</h1>
        <p className="mt-1 text-sm text-ink-600">
          These lists power the destination form and every public filter. Renaming moves existing destinations; hiding keeps them intact.
        </p>
      </div>

      <div className="flex gap-2 rounded-2xl bg-sand-100/60 p-1.5 ring-1 ring-line" role="tablist" aria-label="Option type">
        {(
          [
            { value: "categories", label: "Categories" },
            { value: "regions", label: "Regions" },
          ] as const
        ).map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={tab === entry.value}
            onClick={() => changeTab(entry.value)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              tab === entry.value ? "bg-surf-400 text-white shadow-sm" : "text-ink-700 hover:bg-white/70",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <form onSubmit={add} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Input
              label={`New ${isCategories ? "category" : "region"}`}
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              placeholder={isCategories ? "Hot Springs" : "Ilocos Norte"}
              maxLength={50}
              error={addError ?? undefined}
            />
            <Button type="submit" disabled={adding}>
              {adding ? <Spinner className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>

          {isCategories ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <Select
                label="Icon"
                value={addIcon}
                onChange={(event) => setAddIcon(event.target.value)}
                options={ICON_OPTIONS}
              />
              <ColorPicker label="Color" value={addColor} onChange={setAddColor} />
            </div>
          ) : null}
        </form>
      </Card>

      {error ? <InlineError message={error} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-10 text-sm text-ink-600">
          <Spinner className="h-4 w-4" /> Loading options…
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" detail={`Add your first ${isCategories ? "category" : "region"} above.`} />
      ) : (
        <Card className="p-3 sm:p-4">
          <p className="mb-2 px-2 text-xs text-ink-600">Drag the handle to reorder. The order is used in the destination form and filters.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {items.map((item) => (
                  <SortableOptionRow
                    key={item.id}
                    item={item}
                    kind={tab}
                    editing={editingId === item.id}
                    busy={busyId === item.id}
                    editName={editName}
                    editIcon={editIcon}
                    editColor={editColor}
                    onEditName={setEditName}
                    onEditIcon={setEditIcon}
                    onEditColor={setEditColor}
                    onStartEdit={() => startEdit(item)}
                    onSaveEdit={() => void saveEdit(item)}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleActive={() => void toggleActive(item)}
                    onDelete={() => {
                      setDeleteTarget(item);
                      setReassignTo("");
                      setDeleteError(null);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </Card>
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setReassignTo("");
            setDeleteError(null);
          }
        }}
        title={`Delete ${deleteTarget?.name ?? "option"}?`}
        description={
          deleteTarget?.is_system
            ? "System options can be hidden but never deleted."
            : "Deleting removes the option from the dropdowns. Existing destinations only move when you choose a replacement."
        }
        busy={deleting}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setReassignTo("");
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmDelete()}
              disabled={deleting || deleteTarget?.is_system || (deleteUsage > 0 && !reassignTo)}
            >
              {deleting ? <Spinner className="h-4 w-4" /> : null}
              Delete
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <div className="space-y-3 text-sm text-ink-700">
            {deleteTarget.is_system ? (
              <p className="rounded-xl bg-sand-100 px-3 py-2">
                This is a system option. Hide it instead if you no longer want it in the dropdowns.
              </p>
            ) : deleteUsage > 0 ? (
              <>
                <p className="rounded-xl bg-mango-400/20 px-3 py-2 text-lagoon-900">
                  Used by {deleteTarget.destinations_count} {deleteTarget.destinations_count === 1 ? "destination" : "destinations"}
                  {deleteTarget.itinerary_items_count
                    ? ` and ${deleteTarget.itinerary_items_count} itinerary ${deleteTarget.itinerary_items_count === 1 ? "stop" : "stops"}`
                    : ""}
                  . Choose where to move them, or hide the option instead.
                </p>
                <Select
                  label="Move existing records to"
                  value={reassignTo}
                  onChange={(event) => {
                    setReassignTo(event.target.value);
                    setDeleteError(null);
                  }}
                  emptyLabel="Choose a replacement"
                  options={reassignOptions.map((item) => ({
                    value: String(item.id),
                    label: `${item.name}${item.is_active ? "" : " (hidden)"}`,
                  }))}
                />
              </>
            ) : (
              <p>This option is not used by any destination, so it is safe to delete.</p>
            )}

            {deleteError ? <InlineError message={deleteError} /> : null}
          </div>
        ) : null}
      </Modal>

      {toast ? (
      <div className="fixed inset-x-4 bottom-[calc(var(--bottom-nav-h)+1rem)] z-[1300] mx-auto w-fit max-w-sm rounded-xl bg-lagoon-900 px-4 py-3 text-sm font-medium text-sand-50 shadow-lg sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

interface SortableOptionRowProps {
  item: AdminDestinationOption;
  kind: DestinationOptionKind;
  editing: boolean;
  busy: boolean;
  editName: string;
  editIcon: string;
  editColor: string;
  onEditName: (value: string) => void;
  onEditIcon: (value: string) => void;
  onEditColor: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function SortableOptionRow({
  item,
  kind,
  editing,
  busy,
  editName,
  editIcon,
  editColor,
  onEditName,
  onEditIcon,
  onEditColor,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  onDelete,
}: SortableOptionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const isCategories = kind === "categories";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl bg-white/70 px-2 py-2 ring-1 ring-inset ring-line/70 sm:px-3",
        isDragging && "z-10 shadow-lg ring-surf-400",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink-500 hover:bg-sand-100 focus:outline-none focus:ring-2 focus:ring-surf-400 active:cursor-grabbing"
            aria-label={`Drag ${item.name} to reorder`}
            {...attributes}
            {...listeners}
          >
            <GripIcon className="h-4 w-4" />
          </button>

          {isCategories && !editing ? (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-sea-600"
              style={item.color ? { backgroundColor: `${item.color}1a`, color: item.color } : undefined}
              aria-hidden="true"
            >
              <OptionIcon icon={item.icon} className="h-4 w-4" />
            </span>
          ) : null}

          {editing ? (
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
              <Input value={editName} onChange={(event) => onEditName(event.target.value)} maxLength={50} aria-label={`Rename ${item.name}`} />
              {isCategories ? (
                <div className="flex items-center gap-2">
                  <Select value={editIcon} onChange={(event) => onEditIcon(event.target.value)} options={ICON_OPTIONS} aria-label="Icon" className="h-11" />
                  <ColorPicker value={editColor} onChange={onEditColor} compact />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-ink-900">{item.name}</span>
                {item.is_system ? <Badge tone="sea">System</Badge> : null}
                {!item.is_active ? <Badge tone="neutral">Hidden</Badge> : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-600">
                {item.destinations_count} {item.destinations_count === 1 ? "destination" : "destinations"}
                {isCategories && item.itinerary_items_count
                  ? ` · ${item.itinerary_items_count} itinerary ${item.itinerary_items_count === 1 ? "stop" : "stops"}`
                  : ""}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {editing ? (
            <>
              <Button size="sm" onClick={onSaveEdit} disabled={busy} aria-label="Save">
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={onCancelEdit} disabled={busy} aria-label="Cancel">
                <XIcon className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="switch"
                aria-checked={item.is_active}
                aria-label={`${item.is_active ? "Hide" : "Show"} ${item.name}`}
                onClick={onToggleActive}
                disabled={busy}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                  item.is_active ? "bg-surf-400" : "bg-sand-200",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    item.is_active ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
              <Button size="sm" variant="secondary" onClick={onStartEdit} disabled={busy} aria-label={`Edit ${item.name}`}>
                <PencilIcon className="h-3.5 w-3.5" />
                Edit
              </Button>
              {item.is_system ? (
                <Button size="sm" variant="secondary" disabled title="System options can be hidden but not deleted">
                  Delete
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  compact = false,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", compact && "min-w-0")}>
      {label ? <span className="block text-sm font-semibold text-ink-900">{label}</span> : null}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label ?? "Color"}>
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="No color"
          aria-pressed={value === ""}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs text-ink-500 ring-1 ring-inset ring-line",
            value === "" && "ring-2 ring-surf-400",
          )}
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Use color ${color}`}
            aria-pressed={value === color}
            className={cn("h-7 w-7 rounded-full ring-1 ring-inset ring-black/10", value === color && "ring-2 ring-offset-2 ring-surf-400")}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
