import type { ReactNode } from "react";

import { CalendarIcon, ClockIcon, TicketIcon } from "@/components/icons";

interface InfoCardsProps {
  entranceFee: string;
  visitDuration: string;
  openingHours: string;
  variant?: "cards" | "inline";
}

export function InfoCards({ entranceFee, visitDuration, openingHours, variant = "cards" }: InfoCardsProps) {
  if (variant === "inline") {
    const pairs = [
      { label: "Entrance Fee", value: entranceFee },
      { label: "Visit Duration", value: visitDuration },
      { label: "Opening Hours", value: openingHours },
    ];
    return (
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {pairs.map((pair) => (
          <p key={pair.label} className="text-[13px] text-ink-600">
            {pair.label}: <span className="font-semibold text-lagoon-900">{pair.value}</span>
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <InfoCard icon={<TicketIcon className="h-5 w-5" />} label="Entrance Fee" value={entranceFee} />
      <InfoCard icon={<ClockIcon className="h-5 w-5" />} label="Visit Duration" value={visitDuration} />
      <InfoCard icon={<CalendarIcon className="h-5 w-5" />} label="Opening Hours" value={openingHours} />
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surf-400/15 text-sea-600">{icon}</span>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
      </div>
      <p className="mt-3 text-sm leading-snug text-ink-600">{value}</p>
    </div>
  );
}
