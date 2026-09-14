import { Link } from "react-router";

import { Section } from "@/components/common/section";

export default function ContactPage() {
  return (
    <>
      <Section headline="Let’s talk about your Cebu days">
        <p className="max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
          Suroy is a planning side project, not a tour company. For corrections to any place, cost, or tip on this map —
          or just to tell us which beach deserved a pin — write us.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="mailto:suroy@example.com" className="inline-flex h-12 items-center gap-2 rounded-full bg-surf-400 px-6 text-base font-semibold text-lagoon-950 transition-colors hover:bg-surf-300">
            Email suroy@example.com
          </a>
          <Link to="/" className="inline-flex h-12 items-center rounded-full bg-transparent px-6 text-base font-semibold text-sea-500 ring-1 ring-inset ring-line hover:bg-sand-100">
            Back to the map
          </Link>
        </div>
      </Section>
    </>
  );
}