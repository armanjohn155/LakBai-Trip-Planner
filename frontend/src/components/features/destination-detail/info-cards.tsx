import type { ReactNode } from "react";

import { CalendarIcon, ClockIcon, TicketIcon } from "@/components/icons";

interface InfoCardsProps {
  entranceFee: string;
  visitDuration: string;
  openingHours: string;
}

export function InfoCards({ entranceFee, visitDuration, openingHours }: InfoCardsProps) {
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
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surf-400/15 text-sea-600">{icon}</span>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
      </div>
      <p className="mt-3 text-sm leading-snug text-ink-600">{value}</p>
    </div>
  );
}