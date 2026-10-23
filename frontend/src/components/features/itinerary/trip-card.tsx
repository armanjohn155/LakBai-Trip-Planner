/* eslint-disable react-refresh/only-export-components */

import { useState } from "react";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyIcon, FriendsIcon, UserIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Itinerary } from "@/lib/types";

const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

export const TRIP_PLACEHOLDER_IMAGE = "/images/trip-placeholder.svg";

type TripStatus = "upcoming" | "in-progress" | "past";

const statusClasses: Record<TripStatus, string> = {
  upcoming: "bg-surf-400/90 text-royal-950",
  "in-progress": "bg-mango-400/90 text-lagoon-900",
  past: "bg-sand-200/90 text-ink-600",
};

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function tripStatus(itinerary: Itinerary): TripStatus | null {
  const today = localDateString(new Date());
  const start = itinerary.start_date;
  const end = itinerary.end_date;

  if (end && end < today) return "past";
  if (start && start > today) return "upcoming";
  if (start) return "in-progress";
  if (end) return "upcoming";
  return null;
}

const statusLabel: Record<TripStatus, string> = {
  upcoming: "Upcoming",
  "in-progress": "In progress",
  past: "Past",
};

interface TripCardProps {
  itinerary: Itinerary;
  onOpen: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  duplicateBusy?: boolean;
}

export function TripCard({ itinerary, onOpen, onDelete, onDuplicate, duplicateBusy }: TripCardProps) {
  const [errored, setErrored] = useState(false);
  const coverUrl = itinerary.items?.map((item) => item.destination?.image_url).find(Boolean) ?? TRIP_PLACEHOLDER_IMAGE;
  const status = tripStatus(itinerary);
  const isOwner = (itinerary.my_role ?? "owner") === "owner";
  const isShared = itinerary.is_shared === true;
  const memberCount = itinerary.member_count ?? itinerary.members?.length ?? 0;
  const people = [
    ...(itinerary.owner?.name ? [{ id: itinerary.owner.id, name: itinerary.owner.name, avatar_url: itinerary.owner.avatar_url ?? null }] : []),
    ...(itinerary.members ?? []).map((member) => ({ id: member.id, name: member.name, avatar_url: member.avatar_url ?? null })),
  ];
  const budgetHidden = itinerary.summary?.total_estimated_budget === null;
  const roleLabel = itinerary.my_role === "editor" ? "Editor" : itinerary.my_role === "viewer" ? "Viewer" : null;

  const range = itinerary.start_date && itinerary.end_date
    ? `${dayFormat.format(new Date(itinerary.start_date))} – ${dayFormat.format(new Date(itinerary.end_date))}`
    : "Dates not set";

  return (
    <Card className="glass-frost flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-sand-100">
        {errored ? null : (
          <img src={coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setErrored(true)} />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {status ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm",
                statusClasses[status],
              )}
            >
              {statusLabel[status]}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-lagoon-950/65 px-2.5 py-1 text-xs font-semibold text-sand-50 backdrop-blur-sm">
            {itinerary.trip_type === "group" ? <FriendsIcon className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
            {itinerary.trip_type === "group" ? "Group" : "Solo"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-lagoon-900">{itinerary.title}</h3>
            {isShared && roleLabel ? (
              <Badge tone={itinerary.my_role === "editor" ? "surf" : "neutral"}>{roleLabel}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-ink-600">{range}</p>
        </div>

        {itinerary.trip_type === "group" && people.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {people.slice(0, 4).map((person) => (
                <Avatar key={person.id} name={person.name} src={person.avatar_url} className="h-7 w-7 text-[11px] ring-white" />
              ))}
            </div>
            <p className="min-w-0 truncate text-xs text-ink-600">
              {people.length === 1 ? people[0].name : `${people[0].name} + ${Math.max(memberCount, people.length - 1)}`}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral" className="bg-white/20 text-ink-700 ring-1 ring-inset ring-white/30 backdrop-blur-md">
            {itinerary.item_count ?? 0} stops
          </Badge>
          <Badge tone="mango" className="bg-mango-400/20 ring-1 ring-inset ring-mango-400/30 backdrop-blur-md">
            {budgetHidden ? "Budget private" : formatMoney(itinerary.summary?.total_estimated_budget ?? itinerary.total_budget)}
          </Badge>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Button className="flex-1" onClick={onOpen}>
            {isShared ? "Open shared trip" : "Open planner"}
          </Button>
          {onDuplicate ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDuplicate}
              disabled={duplicateBusy}
              aria-label={`Duplicate ${itinerary.title}`}
              title="Duplicate trip"
            >
              <CopyIcon className="h-4 w-4" />
            </Button>
          ) : null}
          {onDelete && isOwner ? (
            <Button variant="danger" size="sm" onClick={onDelete} aria-label={`Delete ${itinerary.title}`}>
              <DeleteIcon />
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}