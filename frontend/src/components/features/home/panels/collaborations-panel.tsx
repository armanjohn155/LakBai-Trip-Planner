import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/hooks/use-auth";
import {
  acceptPendingInvitation,
  apiError,
  createInviteLink,
  createItineraryInvite,
  declinePendingInvitation,
  getItineraryActivities,
  getItineraryMembers,
  getItineraries,
  getPendingInvitations,
  leaveItinerary,
  removeItineraryMember,
  updateItineraryMemberRole,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type {
  Itinerary,
  ItineraryActivity,
  ItineraryMember,
  PendingInvite,
  TripRole,
} from "@/lib/types";

// ── Preview mock data for guest mode (Rule 4: no API calls when guest) ───
const PREVIEW_MEMBERS = [
  { id: 1, name: "You", initials: "ME", role: "owner" as TripRole, email: "you@example.com" },
  { id: 2, name: "Harry", initials: "HY", role: "editor" as TripRole, email: "harry@example.com" },
  { id: 3, name: "Peter", initials: "PX", role: "viewer" as TripRole, email: "peter@example.com" },
];

const PREVIEW_ACTIVITIES = [
  { id: 1, text: "Harry added Kawasan Falls", time: "2h ago", initials: "HY" },
  { id: 2, text: "Peter joined the trip as Viewer", time: "5h ago", initials: "PX" },
  { id: 3, text: "You shared the itinerary invite link", time: "Yesterday", initials: "ME" },
];

const PREVIEW_INVITE = {
  id: 99,
  tripTitle: "Moalboal & Oslob Getaway",
  inviter: "Maria",
  role: "editor" as TripRole,
};

export function CollaborationsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trip, setTrip] = useState<Itinerary | null>(null);
  const [members, setMembers] = useState<ItineraryMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const isOwner = trip ? trip.my_role === "owner" || (trip.owner?.id != null && trip.owner.id === user?.id) : false;

  // Load active trip & its collaborators when logged in
  useEffect(() => {
    if (!user) return;

    let active = true;

    const fetchTripData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [allTrips, invites] = await Promise.all([getItineraries(), getPendingInvitations()]);
        if (!active) return;
        setPendingInvites(invites);

        const currentTrip = allTrips[0] ?? null;
        setTrip(currentTrip);

        if (currentTrip) {
          const [memberRows, activityPage] = await Promise.all([
            getItineraryMembers(currentTrip.id).catch(() => []),
            getItineraryActivities(currentTrip.id).catch(() => ({ data: [] })),
          ]);

          if (active) {
            setMembers(memberRows);
            setActivities(activityPage.data ?? []);
          }
        }
      } catch (err) {
        if (active) setError(apiError(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchTripData();

    return () => {
      active = false;
    };
  }, [user]);

  // Actions for members
  const handleRoleChange = async (member: ItineraryMember, newRole: "editor" | "viewer") => {
    if (!trip) return;
    try {
      const updated = await updateItineraryMemberRole(trip.id, member.id, newRole);
      setMembers(updated);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!trip) return;
    try {
      await removeItineraryMember(trip.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleLeaveTrip = async () => {
    if (!trip || !user) return;
    try {
      await leaveItinerary(trip.id, user.id);
      setTrip(null);
      setMembers([]);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleAcceptInvite = async (itineraryId: number) => {
    try {
      await acceptPendingInvitation(itineraryId);
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== itineraryId));
      navigate(`/app/trips/${itineraryId}`);
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleDeclineInvite = async (itineraryId: number) => {
    try {
      await declinePendingInvitation(itineraryId);
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== itineraryId));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleSendInvite = async () => {
    if (!trip || !inviteIdentifier.trim()) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      await createItineraryInvite(trip.id, {
        type: "email",
        email: inviteIdentifier.trim(),
        role: inviteRole,
      });
      setInviteMsg({ type: "success", text: `Invite sent to ${inviteIdentifier.trim()}!` });
      setInviteIdentifier("");
      // Refresh member list
      const updated = await getItineraryMembers(trip.id);
      setMembers(updated);
    } catch (err) {
      setInviteMsg({ type: "error", text: apiError(err) });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!trip) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const res = await createInviteLink(trip.id, {
        role: inviteRole,
        expires_in_days: 7,
      });
      const link = res.invite_url || `${window.location.origin}/invite/${res.token}`;
      setGeneratedLink(link);
      setInviteMsg({ type: "success", text: "Invite link generated!" });
    } catch (err) {
      setInviteMsg({ type: "error", text: apiError(err) });
    } finally {
      setInviteBusy(false);
    }
  };

  const openInviteAction = () => {
    if (!user) {
      navigate("/login", { state: { from: "/" } });
      return;
    }
    setInviteMsg(null);
    setGeneratedLink(null);
    setInviteIdentifier("");
    setInviteModalOpen(true);
  };

  // Helper for member initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper for role badge tone
  const getRoleTone = (role: TripRole) => {
    if (role === "owner") return "mango";
    if (role === "editor") return "surf";
    return "neutral";
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center p-2 sm:p-3 lg:p-5"
      role="region"
      aria-label="Preview of trip collaborations, tripmates, and shared itinerary activities"
    >
      <article className="w-full max-w-[36rem] max-h-full min-h-0 bg-white rounded-[1.75rem] shadow-[0_8px_24px_rgba(30,42,74,0.08)] border border-white/60 p-3 sm:p-4 lg:p-6 overflow-hidden flex flex-col">
        {/* ── Header row ───────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4 mb-3 sm:mb-4 shrink-0">
          <div className="min-w-0">
            <h2
              className="font-brand font-normal tracking-tight text-lagoon-900 truncate"
              style={{ fontSize: "clamp(1.1rem, 3vw, 1.5rem)" }}
            >
              Collaborations
            </h2>
            {user && trip ? (
              <p className="text-[11px] sm:text-xs text-ink-600 truncate">{trip.title}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={openInviteAction}
            className="flex h-8 sm:h-9 shrink-0 items-center justify-center rounded-full bg-surf-400 px-3 py-1 text-[clamp(0.7rem,2vw,0.8rem)] font-semibold text-white shadow-[0_4px_6px_rgba(20,184,166,0.35)] hover:bg-surf-300 transition-colors"
          >
            <UserPlusIcon className="h-3.5 w-3.5 mr-1" />
            <span>Invite friend</span>
          </button>
        </header>

        {error ? <InlineError message={error} /> : null}

        {/* ── Collaborators & Pending Invites Box (old summary position) ── */}
        <section className="rounded-2xl bg-sand-50/80 border border-line/60 p-3 sm:p-4 mb-3 sm:mb-4 overflow-hidden shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon-900">
              Trip Collaborators
            </span>
            <span className="text-xs font-semibold text-ink-600">
              {!user ? "3 tripmates" : `${members.length || (trip ? 1 : 0)} tripmates`}
            </span>
          </div>

          {/* Guest preview or logged in member list */}
          {!user ? (
            <div className="space-y-1.5 max-h-[105px] sm:max-h-[120px] overflow-y-auto pr-1">
              {PREVIEW_MEMBERS.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surf-400 text-white font-bold text-[10px]">
                      {m.initials}
                    </span>
                    <span className="truncate font-medium text-ink-900">{m.name}</span>
                  </div>
                  <Badge tone={getRoleTone(m.role)} className="capitalize shrink-0">
                    {m.role}
                  </Badge>
                </div>
              ))}
            </div>
          ) : loading ? (
            <p className="text-xs text-ink-600 py-3 text-center">Loading collaborators…</p>
          ) : !trip ? (
            <div className="text-center py-2">
              <p className="text-xs text-ink-600 mb-2">No active trip found.</p>
              <Link to="/app/trips/new">
                <Button size="sm" variant="secondary">Create a trip</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[105px] sm:max-h-[120px] overflow-y-auto pr-1">
              {/* Trip owner row */}
              <div className="flex items-center justify-between gap-2 text-xs py-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mango-400/80 text-lagoon-950 font-bold text-[10px]">
                    {getInitials(trip.owner?.name ?? user.name)}
                  </span>
                  <span className="truncate font-medium text-ink-900">
                    {trip.owner?.name ?? user.name}
                  </span>
                </div>
                <Badge tone="mango">Owner</Badge>
              </div>

              {/* Other members */}
              {members
                .filter((m) => m.id !== trip.owner?.id)
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surf-400 text-white font-bold text-[10px]">
                        {getInitials(m.name)}
                      </span>
                      <span className="truncate font-medium text-ink-900">{m.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(m, m.role === "editor" ? "viewer" : "editor")}
                          title="Click to toggle role"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <Badge tone={getRoleTone(m.role)} className="capitalize cursor-pointer">
                            {m.role} ⇅
                          </Badge>
                        </button>
                      ) : (
                        <Badge tone={getRoleTone(m.role)} className="capitalize">
                          {m.role}
                        </Badge>
                      )}

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          title="Remove collaborator"
                          className="text-ink-600 hover:text-sinulog-red text-[11px] p-0.5"
                        >
                          ✕
                        </button>
                      )}

                      {!isOwner && m.id === user.id && (
                        <button
                          type="button"
                          onClick={handleLeaveTrip}
                          className="text-xs text-sinulog-red hover:underline"
                        >
                          Leave
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Pending invites alert */}
          {!user ? (
            <div className="mt-2 pt-2 border-t border-line/40 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-ink-700">
                <strong className="text-lagoon-900">{PREVIEW_INVITE.inviter}</strong> invited you to{" "}
                <em className="truncate not-italic font-medium">{PREVIEW_INVITE.tripTitle}</em>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Link to="/login">
                  <span className="px-2 py-0.5 rounded-full bg-surf-400 text-white font-semibold text-[10px] hover:bg-surf-300">
                    Accept
                  </span>
                </Link>
              </div>
            </div>
          ) : pendingInvites.length > 0 ? (
            <div className="mt-2 pt-2 border-t border-line/40 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sea-600">
                Pending invitations ({pendingInvites.length})
              </p>
              {pendingInvites.slice(0, 2).map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-2 text-xs bg-white/70 rounded-lg p-1.5 border border-line/40"
                >
                  <span className="truncate text-ink-700">
                    {invite.owner?.name ? (
                      <strong className="text-lagoon-900">{invite.owner.name}</strong>
                    ) : (
                      "A friend"
                    )}{" "}
                    invited you to <em className="not-italic font-medium">{invite.title}</em>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(invite.id)}
                      className="px-2 py-0.5 rounded-full bg-surf-400 text-white font-semibold text-[10px] hover:bg-surf-300"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="px-2 py-0.5 rounded-full bg-sand-200 text-ink-700 font-semibold text-[10px] hover:bg-sand-300"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* ── Recent Activity section (old Expenses position) ────────── */}
        <section className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-2 shrink-0">
            <h3
              className="font-brand font-normal tracking-tight text-lagoon-900"
              style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.15rem)" }}
            >
              Recent activity
            </h3>
            <span className="text-[11px] font-medium text-ink-600">Collaboration updates</span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-line/40 pr-1">
            {!user ? (
              PREVIEW_ACTIVITIES.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surf-400/20 text-sea-700 font-bold text-[9px]">
                      {act.initials}
                    </span>
                    <span className="truncate text-ink-800">{act.text}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-600">{act.time}</span>
                </div>
              ))
            ) : activities.length === 0 ? (
              <p className="text-xs text-ink-600 py-3 text-center">
                No recent activity yet. Changes made by collaborators will appear here.
              </p>
            ) : (
              activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surf-400/20 text-sea-700 font-bold text-[9px]">
                      {act.user ? getInitials(act.user) : "TR"}
                    </span>
                    <span className="truncate text-ink-800">
                      {act.user ?? "Collaborator"} {act.action}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-600">
                    {act.created_at
                      ? new Date(act.created_at).toLocaleDateString([], { month: "short", day: "numeric" })
                      : "Recently"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </article>

      {/* ── Invite modal ─────────────────────────────────────────── */}
      <Modal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite friends to collaborate"
        description="Plan your itinerary together. Friends can view or help arrange stops."
        size="sm"
      >
        <div className="space-y-4 p-1">
          {inviteMsg ? (
            <div
              className={cn(
                "p-3 rounded-xl text-xs font-medium",
                inviteMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200",
              )}
            >
              {inviteMsg.text}
            </div>
          ) : null}

          <div className="space-y-2">
            <Input
              label="Friend's email"
              placeholder="friend@example.com"
              value={inviteIdentifier}
              onChange={(e) => setInviteIdentifier(e.target.value)}
            />

            <Select
              label="Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              options={[
                { value: "editor", label: "Editor (Can edit stops and details)" },
                { value: "viewer", label: "Viewer (Can view trip plan only)" },
              ]}
            />

            <Button
              className="w-full mt-2"
              size="md"
              disabled={inviteBusy || !inviteIdentifier.trim()}
              onClick={handleSendInvite}
            >
              {inviteBusy ? "Sending…" : "Send invitation"}
            </Button>
          </div>

          <div className="flex items-center gap-3 my-2 text-xs text-ink-600">
            <div className="flex-1 border-t border-line/60" />
            <span>or share a link</span>
            <div className="flex-1 border-t border-line/60" />
          </div>

          <div className="space-y-2">
            {generatedLink ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="h-10 w-full rounded-xl bg-sand-100 px-3 text-xs text-ink-900 border border-line select-all"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    setInviteMsg({ type: "success", text: "Link copied to clipboard!" });
                  }}
                >
                  Copy
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                size="md"
                disabled={inviteBusy}
                onClick={handleGenerateLink}
              >
                Create invite link
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
