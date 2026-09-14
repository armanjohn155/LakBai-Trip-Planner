import { useLocation, useParams } from "react-router";

import { ItineraryBuilder } from "@/components/features/itinerary/itinerary-builder";

export default function ItineraryPage() {
  const { id } = useParams();
  const location = useLocation();
  const addDestinationId = (location.state as { addDestinationId?: number } | null)?.addDestinationId;

  if (!id || Number.isNaN(Number(id))) {
    return <p className="text-sm text-ink-600">That trip does not exist.</p>;
  }

  return <ItineraryBuilder itineraryId={Number(id)} initialAddDestinationId={addDestinationId} />;
}