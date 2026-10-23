import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocation, useNavigate } from "react-router";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { TripCard, tripStatus } from "@/components/features/itinerary/trip-card";
import { CheckIcon, ChevronIcon, FriendsIcon, PinIcon, UserIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import {
  acceptPendingInvitation,
  addItineraryItem,
  apiError,
  createItinerary,
  declinePendingInvitation,
  deleteItinerary,
  getAllItineraries,
  getDestinations,
  getPendingInvitations,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Destination, Itinerary, PendingInvite } from "@/lib/types";

type TripSort = "upcoming" | "recent" | "soonest" | "latest";
type TripFilter = "all" | "owned" | "shared" | "invited";

const TRIP_SORT_OPTIONS: { value: TripSort; label: string }[] = [
  { value: "upcoming", label: "Upcoming first" },
  { value: "recent", label: "Recently edited" },
  { value: "soonest", label: "Trip date (soonest)" },
  { value: "latest", label: "Trip date (latest)" },
];

export default function TripsPage() {
  const navigate = useNavigate();
  const routeState = (useLocation().state as { addDestinationId?: number } | null) ?? {};
  const addDestinationId = routeState.addDestinationId;

  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TripSort>("upcoming");
  const [filter, setFilter] = useState<TripFilter>("all");
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [tripList, invites, page] = await Promise.all([
      getAllItineraries(),
      getPendingInvitations(),
      getDestinations({ per_page: 100 }),
    ]);
    setTrips(tripList);
    setPendingInvites(invites);
    setDestinations(page.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Data is fetched on mount; all state updates happen in promise callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const destinationName = addDestinationId
    ? destinations.find((destination) => destination.id === addDestinationId)?.name ?? "this spot"
    : null;

  const remove = async (itinerary: Itinerary) => {
    if (!window.confirm(`Delete “${itinerary.title}” and all its stops?`)) return;
    try {
      await deleteItinerary(itinerary.id);
      setTrips((current) => current.filter((trip) => trip.id !== itinerary.id));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const acceptInvite = async (invite: PendingInvite) => {
    setBusyInviteId(invite.id);
    setError(null);
    try {
      await acceptPendingInvitation(invite.id);
      setPendingInvites((current) => current.filter((item) => item.id !== invite.id));
      await refresh();
      navigate(`/app/trips/${invite.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyInviteId(null);
    }
  };

  const declineInvite = async (invite: PendingInvite) => {
    setBusyInviteId(invite.id);
    setError(null);
    try {
      await declinePendingInvitation(invite.id);
      setPendingInvites((current) => current.filter((item) => item.id !== invite.id));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyInviteId(null);
    }
  };

  const duplicate = async (itinerary: Itinerary) => {
    setDuplicatingId(itinerary.id);
    try {
      const copy = await createItinerary({
        title: `${itinerary.title} (Copy)`,
        budget: itinerary.budget ?? null,
        start_date: null,
        end_date: null,
      });
      for (const item of itinerary.items ?? []) {
        await addItineraryItem(copy.id, {
          destination_id: item.destination_id,
          day_number: item.day_number,
          order: item.order,
          estimated_budget: item.estimated_budget == null ? null : Number(item.estimated_budget),
          notes: item.notes,
          visited: item.visited,
        });
      }
      navigate(`/app/trips/${copy.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDuplicatingId(null);
    }
  };

  const sortedTrips = useMemo(() => {
    const list = [...trips];
    switch (sortBy) {
      case "recent":
        return list.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
      case "soonest":
        return list.sort((a, b) => (a.start_date ?? "9999-12-31").localeCompare(b.start_date ?? "9999-12-31"));
      case "latest":
        return list.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
      case "upcoming":
      default: {
        const rank = (trip: Itinerary) => {
          const status = tripStatus(trip);
          if (status === "upcoming") return 0;
          if (status === "in-progress") return 1;
          if (status === "past") return 2;
          return 3;
        };
        return list.sort((a, b) => {
          const byStatus = rank(a) - rank(b);
          if (byStatus !== 0) return byStatus;
          return (a.start_date ?? "9999-12-31").localeCompare(b.start_date ?? "9999-12-31");
        });
      }
    }
  }, [trips, sortBy]);

  const visibleTrips = useMemo(() => {
    if (filter === "owned") return sortedTrips.filter((trip) => (trip.my_role ?? "owner") === "owner");
    if (filter === "shared") return sortedTrips.filter((trip) => trip.is_shared);
    return sortedTrips;
  }, [filter, sortedTrips]);

  const showInvites = filter === "all" || filter === "invited";
  const showTrips = filter !== "invited";
  const inviteCount = pendingInvites.length;

  if (loading) {
    return <p className="text-sm text-ink-600">Loading your trips…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">My trips</h1>
          <p className="mt-1 text-sm text-ink-600">Every stop, every peso — in one planner.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SortDropdown
            className="h-10 w-48"
            ariaLabel="Sort trips by"
            value={sortBy}
            onChange={setSortBy}
            options={TRIP_SORT_OPTIONS}
          />
          <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter trips">
        {([
          { id: "all", label: "All trips", count: trips.length + inviteCount },
          { id: "owned", label: "Mine", count: trips.filter((trip) => (trip.my_role ?? "owner") === "owner").length },
          { id: "shared", label: "Shared with me", count: trips.filter((trip) => trip.is_shared).length },
          { id: "invited", label: "Invitations", count: inviteCount },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              filter === item.id
                ? "bg-lagoon-900 text-sand-50"
                : "bg-white/60 text-ink-700 ring-1 ring-inset ring-line hover:bg-sand-100",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                filter === item.id ? "bg-white/15 text-sand-50" : "bg-sand-200/80 text-ink-600",
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {addDestinationId ? (
        <div className="rounded-2xl bg-lagoon-900 p-5 text-sand-50">
          <p className="font-display text-xl font-medium">Add {destinationName} to a trip</p>
          <p className="mt-1 text-sm text-sand-50/70">Pick an existing trip, or start planning a new one.</p>
          {trips.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {trips.map((trip) => (
                <Button
                  key={trip.id}
                  variant="ghost"
                  onClick={() => navigate(`/app/trips/${trip.id}`, { state: { addDestinationId } })}
                >
                  {trip.title}
                </Button>
              ))}
              <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={() => navigate("/app/trips/new")}>Plan a new trip</Button>
            </div>
          )}
        </div>
      ) : null}

      {showInvites && pendingInvites.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-lagoon-900">Invitations</h2>
            <Badge tone="mango">{inviteCount}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingInvites.map((invite) => (
              <article key={invite.id} className="relative overflow-hidden rounded-2xl bg-lagoon-900 p-5 text-sand-50">
                <div className="absolute -right-5 -top-8 h-24 w-24 rounded-full bg-surf-400/20" aria-hidden="true" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
                      <FriendsIcon className="h-3.5 w-3.5" />
                      {invite.trip_type === "group" ? "Group trip" : "Trip invite"}
                    </span>
                    <span className="rounded-full bg-mango-400 px-2.5 py-1 text-xs font-bold text-lagoon-950">
                      {invite.invited_role === "editor" ? "Editor" : "Viewer"}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold">{invite.title}</h3>
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar
                      name={invite.owner.name ?? "LakBai traveller"}
                      src={invite.owner.avatar_url ?? null}
                      className="h-8 w-8 text-xs"
                    />
                    <p className="min-w-0 text-sm text-sand-50/80">
                      <span className="font-semibold text-sand-50">{invite.owner.name ?? "A traveller"}</span> invited you
                      {invite.member_count ? ` · ${invite.member_count} ${invite.member_count === 1 ? "traveller" : "travellers"}` : ""}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1 bg-surf-400 text-white hover:bg-surf-300"
                      onClick={() => void acceptInvite(invite)}
                      disabled={busyInviteId === invite.id}
                    >
                      <CheckIcon className="h-4 w-4" />
                      {busyInviteId === invite.id ? "Joining..." : "Accept"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="ring-1 ring-inset ring-white/20"
                      onClick={() => void declineInvite(invite)}
                      disabled={busyInviteId === invite.id}
                    >
                      <XIcon className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showTrips ? (
        visibleTrips.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-sea-600">
              {filter === "shared" ? <UserIcon className="h-6 w-6" /> : <PinIcon className="h-6 w-6" />}
            </span>
            <h3 className="mt-1 font-display text-2xl font-medium text-lagoon-900">
              {filter === "shared" ? "No shared trips yet" : filter === "owned" ? "No trips of your own yet" : "No trips yet"}
            </h3>
            <p className="max-w-md text-sm text-ink-600">
              {filter === "shared"
                ? "When a friend invites you, their trip will show up here."
                : "Start planning your first Cebu adventure."}
            </p>
            {filter !== "shared" ? (
              <Button size="lg" className="mt-3" onClick={() => navigate("/app/trips/new")}>
                Plan a new trip
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTrips.map((trip) => (
              <TripCard
                key={trip.id}
                itinerary={trip}
                onOpen={() => navigate(`/app/trips/${trip.id}`)}
                onDelete={() => remove(trip)}
                onDuplicate={() => void duplicate(trip)}
                duplicateBusy={duplicatingId === trip.id}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

interface SortDropdownProps {
  className?: string;
  ariaLabel: string;
  value: TripSort;
  onChange: (value: TripSort) => void;
  options: { value: TripSort; label: string }[];
}

function SortDropdown({ className, ariaLabel, value, onChange, options }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center justify-between gap-2 rounded-xl bg-white/70 px-4 text-sm font-medium text-ink-900 backdrop-blur-sm ring-1 ring-inset ring-line focus:ring-2 focus:ring-surf-400 focus:outline-none",
          className,
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronIcon className={cn("h-4 w-4 shrink-0 text-ink-600 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div role="listbox" aria-label={ariaLabel} className="glass-frost absolute right-0 top-full z-50 mt-2 w-48 rounded-xl p-1.5">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                option.value === value ? "bg-white/20 text-lagoon-900" : "text-ink-700 hover:bg-white/15",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}