import { useEffect, useState } from "react";

import { Link, useParams } from "react-router";

import { DestinationForm } from "@/components/features/admin/destination-form";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { apiError, getAdminDestination } from "@/lib/api";
import type { Destination } from "@/lib/types";

export default function AdminDestinationEditPage() {
  const { id } = useParams();
  const destinationId = Number(id);
  const invalidId = !Number.isFinite(destinationId);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;

    let active = true;

    getAdminDestination(destinationId)
      .then((response) => {
        if (active) {
          setDestination(response);
          setError(null);
        }
      })
      .catch((requestError) => {
        if (active) setError(apiError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [destinationId, invalidId]);

  if (invalidId) {
    return (
      <div className="space-y-4">
        <InlineError message="That destination could not be found." />
        <Link to="/admin/destinations" className="text-sm font-semibold text-sea-600 hover:underline">
          Back to destinations
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-10 text-sm text-ink-600">
        <Spinner className="h-4 w-4" /> Loading destination…
      </div>
    );
  }

  if (error || !destination) {
    return (
      <div className="space-y-4">
        <InlineError message={error ?? "That destination could not be found."} />
        <Link to="/admin/destinations" className="text-sm font-semibold text-sea-600 hover:underline">
          Back to destinations
        </Link>
      </div>
    );
  }

  return <DestinationForm destination={destination} />;
}
