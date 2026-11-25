import type { ComponentType } from "react";

import { CollaborationIllustration } from "./collaboration-illustration";

interface Highlight {
  tag: string;
  title: string;
  description: string;
  image?: string;
  illustration?: ComponentType<{ className?: string }>;
  alt: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    tag: "Your trip, organized",
    title: "Build your itinerary to see every stop in one place.",
    description:
      "Add the places you want to visit, organize them by day, and add times and notes. Reorder stops as your plans change and keep the whole trip easy to follow.",
    image: "/images/panels/itinerary.png",
    alt: "Lakbai itinerary preview beside a map of Cebu with numbered trip stops",
  },
  {
    tag: "Plan the route",
    title: "Plan a road trip, stop by stop.",
    description:
      "View your destinations on a map and plan the journey between them. Keep route details and each stop together as you shape your Cebu trip.",
    image: "/images/panels/route.png",
    alt: "Lakbai route preview showing a Cebu map and a trip route across several destinations",
  },
  {
    tag: "Travel together",
    title: "Plan your Cebu trip with your friends, in one place.",
    description:
      "Invite friends to your trip, plan stops together, and keep everyone on the same itinerary.",
    illustration: CollaborationIllustration,
    alt: "Illustration representing collaborating on a trip with friends",
  },
];

export function FeatureHighlights() {
  return (
    <section aria-label="Ways Lakbai helps you plan" className="py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-12 px-4 sm:space-y-16 sm:px-6 lg:space-y-20 lg:px-8">
        {HIGHLIGHTS.map((highlight, index) => {
          const imageFirst = index % 2 === 0;

          return (
            <article
              key={highlight.title}
              className="grid items-center gap-7 sm:gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={imageFirst ? "lg:order-1" : "lg:order-2"}>
                <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-3 shadow-[0_16px_40px_rgba(10,51,48,0.08)] sm:rounded-[2rem] sm:p-5">
                  {highlight.illustration ? (
                    <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden sm:rounded-3xl">
                      <highlight.illustration className="h-full w-full" />
                    </div>
                  ) : (
                    <img
                      src={highlight.image}
                      alt={highlight.alt}
                      className="aspect-[16/10] w-full rounded-2xl object-contain sm:rounded-3xl"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>

              <div className={imageFirst ? "lg:order-2" : "lg:order-1"}>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-sea-600">
                  {highlight.tag}
                </p>
                <h2 className="max-w-xl font-display text-2xl font-bold leading-tight tracking-tight text-lagoon-900 sm:text-3xl lg:text-4xl">
                  {highlight.title}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-700 sm:mt-5 sm:text-lg">
                  {highlight.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
