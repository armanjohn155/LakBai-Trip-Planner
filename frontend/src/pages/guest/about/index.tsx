import { Section } from "@/components/common/section";

export default function AboutPage() {
  return (
    <>
      <Section headline="Why Lakbai?">
        <div className="space-y-4 text-base leading-relaxed text-ink-600 sm:text-lg">
          <p>
            Cebu is one island but many trips — city mornings in Metro Cebu, canyon jumps in Badian, turtle snorkels off
            Moalboal, island hops past Bantayan. Planning that by hand usually means juggling dozens of tabs and guessing
            the budget at the end.
          </p>
          <p>
            Lakbai (Cebuano for “to roam”) pins a curated set of real places on one map, each with an estimated cost. You
            pick a place, drop it into a trip, set your days, and the planner tallies the pesos as you go — grouped by
            category so you can see where the trip money actually goes.
          </p>
        </div>
      </Section>

      <Section headline="How it works" className="bg-transparent pt-0 lg:pt-0 lg:pb-0 lg:mt-0">
        <div className="grid gap-6 sm:grid-cols-3">
          <Step number="01" title="Browse the map" detail="Metro, North, or South Cebu — tap a pin to see a place, its category, and what a visit roughly costs." />
          <Step number="02" title="Build with days in view" detail="Add stops, order them by day, and adjust any estimate if you ride a van instead of a bus." />
          <Step number="03" title="Watch the total move" detail="A live budget summary groups beach days, food stops, and heritage visits so nothing surprises you." />
        </div>
      </Section>

      <Section headline="Being honest about costs">
        <p className="max-w-3xl text-base leading-relaxed text-ink-600 sm:text-lg">
          Estimates are ballpark figures from how visitors usually travel — entry fees, common transfers, and shared
          tours. They are not quotes and not bookings. Ferry prices, holiday rates, and entrance fees change; double-check
          them before you go, and treat the numbers as a planning guide, not a promise.
        </p>
      </Section>
    </>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-sand-50 p-6">
      <p className="font-display text-3xl font-semibold text-surf-400">{number}</p>
      <h3 className="mt-3 font-display text-xl font-medium text-lagoon-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{detail}</p>
    </div>
  );
}