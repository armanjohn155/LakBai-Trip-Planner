interface ShowcaseDestination {
  name: string;
  description: string;
  image: string;
  alt: string;
}

const SHOWCASE_DESTINATIONS: ShowcaseDestination[] = [
  {
    name: "Bantayan Island",
    description: "White-sand shores, clear water, and a relaxed island atmosphere.",
    image: "/images/destinations/bantayan-island.jpg",
    alt: "Aerial view of the coast and clear water on Bantayan Island",
  },
  {
    name: "Moalboal",
    description: "Known for its sardine run, snorkeling, and diving.",
    image: "/images/destinations/moalboal.jpg",
    alt: "A swimmer surrounded by a school of sardines in Moalboal",
  },
  {
    name: "Kawasan Falls",
    description: "A popular waterfall with turquoise pools and canyon views.",
    image: "/images/destinations/kawasan-falls.jpg",
    alt: "Kawasan Falls flowing into a turquoise pool",
  },
  {
    name: "Sirao Flower Garden",
    description: "Colorful garden views in the hills of Cebu City.",
    image: "/images/destinations/sirao-flower-garden.webp",
    alt: "Bright flowers and mountain scenery at Sirao Flower Garden",
  },
  {
    name: "Magellan’s Cross",
    description: "A landmark in the historic heart of Cebu City.",
    image: "/images/destinations/magellans-cross.jpg",
    alt: "The Magellan’s Cross pavilion in Cebu City",
  },
  {
    name: "Temple of Leah",
    description: "A grand hilltop landmark with views across Cebu City.",
    image: "/images/destinations/temple-of-leah.jpg",
    alt: "The grand columns and statues of the Temple of Leah",
  },
  {
    name: "Osmeña Peak",
    description: "Cebu’s highest peak, known for its jagged green hills.",
    image: "/images/destinations/osmena-peak.jpg",
    alt: "Green mountain peaks and a wide view from Osmeña Peak",
  },
];

function DestinationCard({ destination, heightClass }: { destination: ShowcaseDestination; heightClass: string }) {
  return (
    <article
      className={`group relative isolate overflow-hidden rounded-2xl bg-lagoon-900 shadow-[0_8px_20px_rgba(10,51,48,0.1)] ${heightClass}`}
    >
      <img
        src={destination.image}
        alt={destination.alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      <div
        className={`absolute inset-x-0 bottom-0 flex h-32 flex-col justify-center border-t border-white/15 px-5 backdrop-blur-sm sm:px-6 lg:px-7 ${
          destination.name === "Moalboal" ? "bg-slate-950/15" : "bg-slate-950/30"
        }`}
      >
        <h3 className="line-clamp-1 min-h-[1.2em] font-display text-xl font-bold leading-tight text-white sm:text-2xl lg:text-[2rem]">
          {destination.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[3em] max-w-xl text-sm font-semibold leading-relaxed text-white/95 sm:text-base">
          {destination.description}
        </p>
      </div>
    </article>
  );
}

export function DestinationShowcase() {
  const [bantayan, moalboal, kawasan, sirao, magellans, temple, osmena] = SHOWCASE_DESTINATIONS;

  return (
    <section aria-labelledby="destination-showcase-heading" className="py-14 sm:py-20">
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
          <h2
            id="destination-showcase-heading"
            className="font-display text-2xl font-bold tracking-tight text-lagoon-900 sm:text-3xl lg:text-4xl"
          >
            Explore places to visit around Cebu
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base">
            From island shores and waterfalls to city landmarks and mountain views, find a stop for your next trip.
          </p>
        </header>

        <div className="space-y-4 lg:space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            <DestinationCard destination={bantayan} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
            <DestinationCard destination={moalboal} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
            <DestinationCard destination={kawasan} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr] lg:gap-5">
            <DestinationCard destination={sirao} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
            <DestinationCard destination={magellans} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
            <DestinationCard destination={temple} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
            <DestinationCard destination={osmena} heightClass="h-[220px] sm:h-[280px] lg:h-[360px] xl:h-[420px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
