/**
 * "Features to replace your tools" section.
 *
 * Static grid of six feature cards, each with an illustration, bold title, and
 * short description. Renders from a typed constant array — no API, no auth, no
 * hooks, no interactivity.
 */

interface FeatureItem {
  label: string;
  title: string;
  description: string;
  image: string;
  alt: string;
}

// Single source of truth for all six feature cards. Adjust titles, descriptions,
// or image paths here — they flow straight into the rendered grid.
const FEATURES: FeatureItem[] = [
  {
    label: "Discover",
    title: "Find places worth the trip",
    description:
      "Explore Cebu destinations by map, region, and category, then save the ones you want to visit.",
    image: "/features-images/add-places.png",
    alt: "Illustration of discovering a place and adding it to a travel plan",
  },
  {
    label: "Budget",
    title: "Plan around your budget",
    description: "Set a trip budget and see estimated costs for stops and each day in one place.",
    image: "/features-images/expense-tracking.png",
    alt: "Illustration representing trip budget planning",
  },
  {
    label: "Progress",
    title: "Keep your trip on track",
    description:
      "Mark itinerary stops as planned, done, or skipped, and look back on places you have visited.",
    image: "/features-images/checklists.png",
    alt: "Illustration of a travel checklist and destination marker",
  },
  {
    label: "Itinerary",
    title: "Shape each day your way",
    description:
      "Arrange destinations by day, add timings and notes, and reorder stops as plans change.",
    image: "/features-images/itineraries.png",
    alt: "Illustration of a day-by-day travel itinerary with destination stops",
  },
  {
    label: "Map",
    title: "See your route at a glance",
    description:
      "View destinations and itinerary stops on an interactive map while you plan your route.",
    image: "/features-images/travel-smarter.png",
    alt: "Illustration of a route connecting places on a map",
  },
  {
    label: "Share",
    title: "Plan together, take it anywhere",
    description:
      "Invite friends to collaborate, then export your itinerary as a PDF, calendar, or GPX route.",
    image: "/features-images/share-export.png",
    alt: "Illustration of sharing a trip plan and exporting a PDF",
  },
];

export function LakbaiFeatures() {
  return (
    <section aria-labelledby="lakbai-features-heading" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h2
            id="lakbai-features-heading"
            className="font-display text-3xl font-bold tracking-tight text-lagoon-900 sm:text-4xl lg:text-5xl"
          >
            Features to replace your tools
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
            Plan your Cebu trip in one place, from finding destinations to sharing your finished itinerary.
          </p>
        </header>

        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-lagoon-900/10 bg-white/90 shadow-[0_8px_24px_rgba(10,51,48,0.06)] transition duration-300 hover:-translate-y-1 hover:border-surf-500/30 hover:shadow-[0_16px_36px_rgba(10,51,48,0.12)]"
            >
              <div className="aspect-[379/185] w-full overflow-hidden border-b border-lagoon-900/10 bg-sand-50">
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  width={379}
                  height={185}
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col px-5 pb-6 pt-5 sm:px-6">
                <span className="mb-3 w-fit rounded-full bg-surf-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-sea-600">
                  {feature.label}
                </span>
                <h3 className="font-display text-lg font-bold leading-snug text-lagoon-900 sm:text-xl">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
