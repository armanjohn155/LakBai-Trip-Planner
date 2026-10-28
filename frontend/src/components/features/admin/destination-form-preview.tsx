import { useMemo } from "react";

import { ActivitiesList } from "@/components/features/destination-detail/activities-list";
import { getDestinationFacts, galleryImages } from "@/components/features/destination-detail/destination-facts";
import { ImageGallery } from "@/components/features/destination-detail/image-gallery";
import { InfoCards } from "@/components/features/destination-detail/info-cards";
import { TipsList } from "@/components/features/destination-detail/tips-list";
import { TransportList } from "@/components/features/destination-detail/transport-list";
import { categoryTag, categoryTone, destinationLocation } from "@/components/features/destinations/destination-explorer-card";
import { GridIcon, PinIcon, StarIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { toNumber } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface PreviewProps {
  values: any;
}

export function DestinationFormPreview({ values }: PreviewProps) {
  const destination: Destination = useMemo(() => {
    const gallery = values.galleryItems?.length
      ? values.galleryItems.map((item: any) => item.preview || item.url).filter(Boolean)
      : values.gallery || [];
    return {
      id: 0,
      name: values.name || "Destination name",
      description: values.description || "Description will appear here.",
      category: values.category || "Beach",
      region: values.region || "Metro Cebu",
      municipality: values.municipality || null,
      latitude: values.latitude || "10.3157",
      longitude: values.longitude || "123.8854",
      estimated_cost: values.estimated_cost || null,
      rating: null,
      review_count: null,
      image_url: gallery[0] || null,
      best_time_to_visit: values.best_time_to_visit || null,
      tips: values.tips || null,
      highlights: values.highlights || [],
      entrance_fee_text: values.entrance_fee_text || null,
      visit_duration: values.visit_duration || null,
      opening_hours: values.opening_hours || null,
      how_to_get_there: values.how_to_get_there || [],
      travel_tips: values.travel_tips?.length ? values.travel_tips : values.tips ? [values.tips] : [],
      gallery,
    } as Destination;
  }, [values]);

  const facts = getDestinationFacts(destination);
  const activities = destination.highlights?.length ? destination.highlights : facts.activities;
  const tips = destination.travel_tips?.length
    ? destination.travel_tips
    : [destination.tips, ...facts.extra_tips].filter((tip): tip is string => Boolean(tip));
  const transport = destination.how_to_get_there?.length
    ? destination.how_to_get_there.map((t: any) => ({
        mode: t.mode || "",
        origin: t.route || "",
        duration: t.duration || "",
        price: t.price_text || "",
      }))
    : facts.transport;

  const rating = toNumber(destination.rating);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight text-lagoon-900 sm:text-2xl">
          {destination.name}
        </h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-line/60">
            <ImageGallery
              images={galleryImages(destination)}
              name={destination.name}
              fallbackTone={categoryTone(destination.category)}
            />
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line/60 sm:p-6">
          <div className="rounded-2xl bg-sand-100/70 p-3.5 ring-1 ring-inset ring-line">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-lagoon-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surf-400/15 text-sea-600">
                  <GridIcon className="h-4 w-4" />
                </span>
                {categoryTag(destination.category)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-lagoon-900 ring-1 ring-inset ring-line">
                <StarIcon className="h-3.5 w-3.5 text-mango-400" />
                {rating ? rating.toFixed(1) : "—"}
              </span>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-600">
              <PinIcon className="h-4 w-4 shrink-0 text-sea-600" />
              <span className="min-w-0">
                {destinationLocation(destination)} · {destination.region}
              </span>
            </p>
          </div>
          {activities.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-[15px] font-semibold text-lagoon-900">Highlights</h2>
              <div className="mt-3">
                <ActivitiesList activities={activities} variant="outline" />
              </div>
            </section>
          ) : null}
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold text-lagoon-900">About</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-600 line-clamp-4">{destination.description}</p>
          </section>
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold text-lagoon-900">Quick info</h2>
            <div className="mt-3">
              <InfoCards
                entranceFee={destination.entrance_fee_text || facts.entrance_fee}
                visitDuration={destination.visit_duration || facts.visit_duration}
                openingHours={destination.opening_hours || facts.opening_hours}
                variant="inline"
              />
            </div>
          </section>
        </div>
      </div>
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold text-lagoon-900">How to Get There</h2>
        </div>
        <TransportList options={transport} />
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold text-lagoon-900">Travel Tips</h2>
        </div>
        <TipsList tips={tips} />
      </Card>
    </div>
  );
}
