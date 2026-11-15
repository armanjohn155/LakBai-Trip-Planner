import type { ReactNode } from "react";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { formatTripDateRange } from "@/components/features/itinerary/itinerary-constants";
import { CalendarIcon, MapIcon, FriendsIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { RecapAccent, RecapMember } from "@/lib/types";

import { accentGradient, resolveRecapMediaUrl } from "./recap-utils";

interface RecapHeroProps {
  title: string;
  summary: string | null;
  startDate: string | null;
  endDate: string | null;
  dayCount: number;
  coverUrl: string | null;
  accent?: RecapAccent;
  members?: RecapMember[];
  memberCount?: number;
  actions?: ReactNode;
  eyebrow?: string;
}

export function RecapHero({
  title,
  summary,
  startDate,
  endDate,
  dayCount,
  coverUrl,
  accent,
  members = [],
  memberCount,
  actions,
  eyebrow = "Trip recap",
}: RecapHeroProps) {
  const range = formatTripDateRange(startDate, endDate);
  const cover = resolveRecapMediaUrl(coverUrl);
  const people = members.filter((member, index, all) => all.findIndex((entry) => entry.id === member.id) === index);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-lagoon-900 text-sand-50 shadow-xl">
      {cover ? (
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
      ) : null}
      <div className={cn("absolute inset-0", cover ? accentGradient(accent, "opacity-80") : accentGradient(accent))} />
      <div className="absolute inset-0 bg-gradient-to-t from-lagoon-950/85 via-lagoon-950/25 to-transparent" />

      <div className="relative flex min-h-[19rem] flex-col justify-end gap-5 p-6 sm:min-h-[23rem] sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sand-50 backdrop-blur-sm">
              <MapIcon className="h-3.5 w-3.5" />
              {eyebrow}
            </p>

            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white drop-shadow-sm sm:text-5xl">{title}</h1>

            {summary ? (
              <p className="mt-2.5 max-w-xl whitespace-pre-line text-sm leading-relaxed text-sand-50/90 sm:text-base">{summary}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-sand-50/85">
              {range ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {range}
                </span>
              ) : null}
              <span>{dayCount === 1 ? "1 day" : `${dayCount} days`}</span>
              {memberCount !== undefined ? (
                <span className="inline-flex items-center gap-1.5">
                  <FriendsIcon className="h-3.5 w-3.5" />
                  {memberCount === 1 ? "Solo trip" : `${memberCount} travellers`}
                </span>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {people.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {people.slice(0, 6).map((member) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  src={member.avatar_url}
                  className="h-9 w-9 text-xs ring-2 ring-lagoon-950/70"
                />
              ))}
            </div>
            <p className="text-xs text-sand-50/80">
              {people.length === 1 ? people[0].name : `${people[0].name} + ${people.length - 1} more`}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
