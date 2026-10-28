/**
 * "Features to replace your tools" section.
 *
 * Static grid of six feature cards, each with an illustration, bold title, and
 * short description. Renders from a typed constant array — no API, no auth, no
 * hooks, no interactivity.
 */

interface FeatureItem {
  title: string;
  description: string;
  image: string;
  alt: string;
}

// Single source of truth for all six feature cards. Adjust titles, descriptions,
// or image paths here — they flow straight into the rendered grid.
const FEATURES: FeatureItem[] = [
  {
    title: "Add places from anywhere with 1 click",
    description:
      "We crawled the web so you don't have to. Easily add mentioned places to your plan.",
    image: "/features-images/add-places.png",
    alt: "A share interface with a copy link button and PDF export for adding places to a plan",
  },
  {
    title: "Expense tracking",
    description: "Keep track of your budget.",
    image: "/features-images/expense-tracking.png",
    alt: "An expense tracker showing a $48.50 entry approved by Peter",
  },
  {
    title: "Checklists for anything",
    description:
      "Stay organized with a packing list, to-do list, shopping list, any kind of list",
    image: "/features-images/checklists.png",
    alt: "A checklist interface with a location pin marker",
  },
  {
    title: "Itineraries made easy",
    description:
      "Map out your days with places, timings, and plans that stay neatly organized.",
    image: "/features-images/itineraries.png",
    alt: "A Cebu itinerary map with numbered destination stops",
  },
  {
    title: "Travel smarter with Lakbai",
    description:
      "Zoom, drag, and explore your itinerary visually from start to finish.",
    image: "/features-images/travel-smarter.png",
    alt: "An interactive map route with zoom controls and a location pin",
  },
  {
    title: "Share or export your plan",
    description:
      "Send your itinerary as a link or save it as a PDF to use anywhere.",
    image: "/features-images/share-export.png",
    alt: "A share interface with a copy link button and travel blog cards",
  },
];

export function LakbaiFeatures() {
  return (
    <section aria-labelledby="lakbai-features-heading" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 max-w-2xl justify-center">
          <h2
            id="lakbai-features-heading"
            className="font-display text-3xl font-bold tracking-tight text-lagoon-900 sm:text-4xl"
          >
            Features to replace your tools
          </h2>
        </header>

        {/* ── Feature grid ─────────────────────────────────────────── */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="flex flex-col gap-4 sm:gap-5">
              <div className="aspect-[379/185] w-full overflow-hidden rounded-lg bg-white">
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className="w-full h-full object-cover"
                  width={379}
                  height={185}
                  loading="lazy"
                />
              </div>
              <h3 className="font-display font-bold text-lagoon-900 sm:text-base">
                {feature.title}
              </h3>
              <p className="text-ink-600 leading-relaxed text-sm sm:text-base">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
