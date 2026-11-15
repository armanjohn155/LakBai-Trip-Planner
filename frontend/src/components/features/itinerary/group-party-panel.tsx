import { useState } from "react";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { FriendsIcon, MapIcon, PinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";
import { relativeTime } from "@/lib/format";
import type {
  GroupTrackingMember,
  GroupTrackingState,
  TripLifecycleStatus,
  TripRole,
} from "@/lib/types";

import type { GroupTransport } from "@/hooks/use-group-tracking";

interface GroupPartyPanelProps {
  state: GroupTrackingState | null;
  lifecycle: TripLifecycleStatus;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  transport: GroupTransport;
  meetPosition: { lat: number; lng: number } | null;
  onToggleSharing: (enabled: boolean) => void;
  onPinMeetup: (note: string) => Promise<boolean>;
  onFocusMember: (member: GroupTrackingMember) => void;
  onFocusMeetup: () => void;
}

const ROLE_LABEL: Record<TripRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

function expiryLabel(iso: string | null): string {
  if (iso === null) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expired";
  return `${Math.max(1, Math.round(ms / 60_000))} min left`;
}

function memberStatus(member: GroupTrackingMember, viewerSharing: boolean): string {
  if (!member.sharing) return member.is_me ? "You are not sharing" : "Not sharing";
  if (member.is_me) return member.position ? "Sharing your location" : "Waiting for your first GPS fix";
  if (!viewerSharing) return "Sharing location";

  const seen = relativeTime(member.last_seen_at);
  if (member.online) return `Sharing now · ${seen}`;
  return `Last seen ${seen}`;
}

export function GroupPartyPanel({
  state,
  lifecycle,
  loading,
  busy,
  error,
  message,
  transport,
  meetPosition,
  onToggleSharing,
  onPinMeetup,
  onFocusMember,
  onFocusMeetup,
}: GroupPartyPanelProps) {
  const [note, setNote] = useState("");
  const [pinning, setPinning] = useState(false);

  const active = lifecycle === "active";
  const members = state?.members ?? [];
  const sharing = state?.me.sharing ?? false;
  const sharingCount = members.filter((member) => member.sharing).length;
  const onlineCount = members.filter((member) => member.sharing && member.online).length;
  const meetup = state?.meetup ?? null;
  const canPin = active && meetPosition !== null && !busy && !pinning;

  const submitMeetup = async () => {
    if (!canPin) return;
    setPinning(true);
    try {
      const ok = await onPinMeetup(note);
      if (ok) setNote("");
    } finally {
      setPinning(false);
    }
  };

  const transportLabel =
    transport === "live"
      ? "Live updates"
      : transport === "connecting"
        ? "Connecting…"
        : transport === "polling"
          ? "Refreshing every 10s"
          : "Tracking off";

  return (
    <section className="rounded-2xl bg-white/80 p-3 ring-1 ring-inset ring-line/70">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-lagoon-900">
            <FriendsIcon className="h-3.5 w-3.5 text-sea-600" /> Party
            <span className="rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
              {sharingCount}/{members.length || 1} sharing
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-ink-600">
            {loading
              ? "Loading the party…"
              : `${onlineCount} online · ${transportLabel}`}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            sharing ? "bg-emerald-50 text-emerald-700" : "bg-sand-100 text-ink-600",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", sharing ? "bg-emerald-500" : "bg-ink-400")}
            aria-hidden="true"
          />
          {sharing ? "Sharing" : "Off"}
        </span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-3 rounded-xl bg-sand-50 p-2.5">
        <p className="text-[11px] leading-snug text-ink-700">
          <span className="font-semibold text-ink-900">Share my live location with this group.</span>{" "}
          You choose — the trip owner cannot turn this on for you. While it is on, accepted members
          see your latest location, not your history.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={sharing}
          aria-label="Share my live location with the party"
          onClick={() => onToggleSharing(!sharing)}
          disabled={!active || busy}
          className={cn(
            "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            sharing ? "bg-emerald-500" : "bg-sand-300",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              sharing ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {!active ? (
        <p className="mt-2 rounded-xl bg-sand-100 px-2.5 py-2 text-[11px] text-ink-700">
          Sharing opens while the trip is active. It switches off automatically when the trip is paused
          or finished.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-red-50 px-2.5 py-2 text-[11px] text-red-700 ring-1 ring-inset ring-red-200"
        >
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-[11px] text-ink-600">{message}</p> : null}

      {members.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {members.map((member) => (
            <li
              key={member.user_id}
              className={cn(
                "flex items-center gap-2 rounded-xl px-1.5 py-1.5",
                member.is_me && "bg-sand-50",
              )}
            >
              <span className="relative shrink-0">
                <Avatar
                  name={member.name}
                  src={member.avatar_url}
                  className="h-8 w-8 text-xs ring-2 ring-white"
                />
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white",
                    member.sharing ? (member.online ? "bg-emerald-500" : "bg-ink-400") : "bg-sand-300",
                  )}
                  aria-hidden="true"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-xs font-semibold text-ink-900">
                  {member.name}
                  {member.is_me ? <span className="text-[10px] font-medium text-ink-500">(you)</span> : null}
                  {member.role ? (
                    <span className="rounded-full bg-sand-100 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-ink-500">
                      {ROLE_LABEL[member.role]}
                    </span>
                  ) : null}
                  {member.session_status === "paused" ? (
                    <span className="rounded-full bg-mango-100 px-1.5 text-[9px] font-semibold text-mango-700">
                      Paused
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[10px] text-ink-600">
                  {memberStatus(member, sharing)}
                  {sharing && member.distance_to_next_stop_m != null ? (
                    <span> · {formatDistance(member.distance_to_next_stop_m)} to next stop</span>
                  ) : null}
                </p>
                {member.arrived_stop ? (
                  <p className="flex items-center gap-1 truncate text-[10px] font-medium text-sea-600">
                    <span aria-hidden="true" className="font-bold text-emerald-600">✓</span> Arrived at {member.arrived_stop.title}
                  </p>
                ) : null}
              </div>

              {sharing && member.position ? (
                <button
                  type="button"
                  onClick={() => onFocusMember(member)}
                  aria-label={`Center map on ${member.name}`}
                  title={`Center map on ${member.name}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-ink-600">No accepted members yet.</p>
      )}

      {!sharing ? (
        <p className="mt-2 rounded-xl bg-sand-100 px-2.5 py-2 text-[11px] text-ink-700">
          You are not sharing, so the party's dots stay hidden. Switch sharing on to see them too.
        </p>
      ) : (
        <p className="mt-2 text-[10px] leading-snug text-ink-500">
          Phones pause GPS when the screen locks, so a dot can look frozen or turn gray until that
          traveller opens the app again.
        </p>
      )}

      <div className="mt-3 border-t border-line/60 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-lagoon-900">
            <PinIcon className="h-3.5 w-3.5 text-mango-500" /> Meet here
          </p>
          {meetup ? (
            <span className="text-[10px] font-medium text-ink-500">{expiryLabel(meetup.expires_at)}</span>
          ) : null}
        </div>

        {meetup ? (
          <div className="mt-1.5 rounded-xl bg-mango-400/10 px-2.5 py-2 ring-1 ring-inset ring-mango-400/25">
            <p className="truncate text-[11px] font-semibold text-ink-900">
              {meetup.note?.trim() ? meetup.note : "Meeting point"}
            </p>
            <p className="text-[10px] text-ink-600">
              Pinned by {meetup.created_by_name ?? "a traveller"}
            </p>
            <Button size="sm" variant="secondary" className="mt-1.5" onClick={onFocusMeetup}>
              <MapIcon className="h-3.5 w-3.5" /> Show on map
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-ink-600">
            Drops a pin at your current location for 2 hours so everyone can find the spot.
          </p>
        )}

        <div className="mt-1.5 flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={140}
              placeholder="Optional note (e.g. by the fountain)"
              aria-label="Meeting point note"
              className="h-9 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={() => void submitMeetup()}
            disabled={!canPin}
            title={meetPosition === null ? "Turn on sharing and wait for a GPS fix" : undefined}
          >
            <PinIcon className="h-3.5 w-3.5" /> {meetup ? "Move pin" : "Meet here"}
          </Button>
        </div>

        {active && meetPosition === null ? (
          <p className="mt-1 text-[10px] text-ink-500">
            Switch sharing on and wait for your first GPS fix to drop a pin.
          </p>
        ) : null}
      </div>
    </section>
  );
}
