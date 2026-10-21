import { useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { LayersIcon } from "@/components/icons";
import { apiError, getItineraryTemplates, useItineraryTemplate as applyItineraryTemplate } from "@/lib/api";
import { formatMoney, pluralise } from "@/lib/format";
import type { ItineraryTemplate } from "@/lib/types";

interface TemplatesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TemplatesDialog({ open, onClose }: TemplatesDialogProps) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ItineraryTemplate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // Fetch templates when the dialog opens; state updates happen in callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    getItineraryTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(apiError(fetchError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleUse = async (template: ItineraryTemplate) => {
    setBusyId(template.id);
    setError(null);
    try {
      const itinerary = await applyItineraryTemplate(template.id);
      onClose();
      navigate(`/app/trips/${itinerary.id}`);
    } catch (useError) {
      setError(apiError(useError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start from a template" description="Curated Cebu itineraries you can copy and tweak." size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="h-6 w-6 text-surf-500" />
        </div>
      ) : error && (!templates || templates.length === 0) ? (
        <InlineError message={error} />
      ) : !templates || templates.length === 0 ? (
        <EmptyState title="No templates yet" detail="An administrator hasn't published any itinerary templates." />
      ) : (
        <div className="space-y-4">
          {error ? <InlineError message={error} /> : null}
          <ul className="grid gap-4 sm:grid-cols-2">
            {templates.map((template) => (
              <li key={template.id} className="glass flex flex-col overflow-hidden rounded-2xl">
                <div className="aspect-[16/9] w-full overflow-hidden bg-sand-100">
                  {template.cover_image_url ? (
                    <img src={template.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-lagoon-900/90 text-sand-50">
                      <LayersIcon className="h-8 w-8 opacity-70" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-lagoon-900">{template.title}</h3>
                    {template.description ? <p className="mt-1 line-clamp-3 text-sm text-ink-600">{template.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="surf">{pluralise(template.day_count, "day")}</Badge>
                    <Badge tone="mango">{pluralise(template.item_count, "stop")}</Badge>
                    <Badge tone="neutral">{formatMoney(template.estimated_total)}</Badge>
                  </div>
                  <Button
                    className="mt-auto"
                    onClick={() => void handleUse(template)}
                    disabled={busyId !== null}
                  >
                    {busyId === template.id ? "Copying…" : "Use this template"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
