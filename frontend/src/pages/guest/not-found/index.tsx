import { Link } from "react-router";

import { Section } from "@/components/common/section";

export default function NotFoundPage() {
  return (
    <Section headline="That path is not on the map">
      <div className="max-w-2xl space-y-5 text-base leading-relaxed text-ink-600 sm:text-lg">
        <p>
          The page you were looking for may have moved, or the link may be incomplete. Head back to the planner and
          start from the map.
        </p>
        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center rounded-full bg-surf-400 px-6 font-semibold text-white transition hover:bg-surf-400/90"
        >
          Back to Lakbai
        </Link>
      </div>
    </Section>
  );
}
