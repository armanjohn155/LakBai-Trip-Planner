import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { FriendPicker } from "@/components/features/sharing/friend-picker";
import {
  CheckIcon,
  CopyIcon,
  FriendsIcon,
  LogOutIcon,
  ShareIcon,
  ShieldIcon,
  XIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/hooks/use-auth";
import {
  apiConflict,
  apiError,
  createInviteLink,
  getFriends,
  getInviteLinks,
  getItineraryMembers,
  inviteItineraryMembers,
  leaveItinerary,
  removeItineraryMember,
  revokeInviteLink,
  rsvpItinerary,
  transferItineraryOwnership,
  updateItinerary,
  updateItineraryMemberRole,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/trip-draft";
import type { FriendUser, Itinerary, ItineraryInvite, ItineraryMember, TripRole } from "@/lib/types";

type Tab = "members" | "invite" | "link";

interface ShareDialogProps {
  open: boolean;
  itinerary: Itinerary;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onLeft: () => void;
  onConflict?: (fresh: Itinerary) => void;
}

const ROLE_LABEL: Record<TripRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function ShareDialog({ open, itinerary, onClose, onChanged, onLeft, onConflict }: ShareDialogProps) {
  const { user } = useAuth();
  const isOwner = itinerary.my_role === "owner";
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<ItineraryMember[]>([]);
  const [links, setLinks] = useState<ItineraryInvite[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [invitees, setInvitees] = useState<FriendUser[]>([]);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [linkRole, setLinkRole] = useState<"editor" | "viewer">("viewer");
  const [linkExpiry, setLinkExpiry] = useState("7");
  const [linkUses, setLinkUses] = useState("10");
  const [newLink, setNewLink] = useState<string | null>(null);

  const [transferTo, setTransferTo] = useState("");
  const [confirmAction, setConfirmAction] = useState<"transfer" | "leave" | null>(null);

  const acceptedMembers = useMemo(
    () => members.filter((member) => (member.status ?? "accepted") === "accepted" && member.role !== "owner"),
    [members],
  );
  const currentMember = useMemo(() => members.find((member) => member.id === user?.id), [members, user?.id]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // Data is fetched when the dialog opens; state updates happen in callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setNotice(null);
    setNewLink(null);
    setConfirmAction(null);
    setTransferTo("");
    setTab("members");

    const requests: [Promise<ItineraryMember[]>, Promise<ItineraryInvite[]> | null, Promise<FriendUser[]> | null] = [
      getItineraryMembers(itinerary.id),
      isOwner ? getInviteLinks(itinerary.id) : null,
      isOwner ? getFriends() : null,
    ];

    Promise.all([
      requests[0],
      requests[1] ?? Promise.resolve([]),
      requests[2] ?? Promise.resolve([]),
    ])
      .then(([memberRows, linkRows, friendRows]) => {
        if (cancelled) return;
        setMembers(memberRows);
        setLinks(linkRows);
        setFriends(friendRows);
      })
      .catch((loadError) => {
        if (!cancelled) setError(apiError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, itinerary.id, isOwner]);

  const reloadMembers = async () => {
    const rows = await getItineraryMembers(itinerary.id);
    setMembers(rows);
  };

  const handleInvite = async () => {
    if (invitees.length === 0) return;
    setBusyKey("invite");
    setError(null);
    setNotice(null);
    try {
      const rows = await inviteItineraryMembers(itinerary.id, {
        user_ids: invitees.map((friend) => friend.id),
        role: inviteRole,
      });
      setMembers(rows);
      setInvitees([]);
      setNotice(`Invite sent to ${invitees.length === 1 ? invitees[0].name : `${invitees.length} friends`}.`);
      await onChanged();
    } catch (inviteError) {
      setError(apiError(inviteError));
    } finally {
      setBusyKey(null);
    }
  };

  const handleRole = async (member: ItineraryMember, role: "editor" | "viewer") => {
    setBusyKey(`role-${member.id}`);
    setError(null);
    try {
      setMembers(await updateItineraryMemberRole(itinerary.id, member.id, role));
      setNotice(`${member.name} is now an ${role}.`);
      await onChanged();
    } catch (roleError) {
      setError(apiError(roleError));
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (member: ItineraryMember) => {
    const pending = (member.status ?? "accepted") === "pending";
    if (!window.confirm(pending ? `Cancel the invite for ${member.name}?` : `Remove ${member.name} from this trip?`)) return;

    setBusyKey(`remove-${member.id}`);
    setError(null);
    try {
      await removeItineraryMember(itinerary.id, member.id);
      await reloadMembers();
      setNotice(pending ? "Invitation cancelled." : `${member.name} removed from the trip.`);
      await onChanged();
    } catch (removeError) {
      setError(apiError(removeError));
    } finally {
      setBusyKey(null);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setBusyKey("leave");
    setError(null);
    try {
      await leaveItinerary(itinerary.id, user.id);
      onClose();
      onLeft();
    } catch (leaveError) {
      setError(apiError(leaveError));
      setBusyKey(null);
    }
  };

  const handleTransfer = async () => {
    const target = acceptedMembers.find((member) => String(member.id) === transferTo);
    if (!target) return;
    setBusyKey("transfer");
    setError(null);
    try {
      await transferItineraryOwnership(itinerary.id, target.id);
      setConfirmAction(null);
      setNotice(`${target.name} is now the owner. You are still an editor.`);
      await onChanged();
      await reloadMembers();
    } catch (transferError) {
      setError(apiError(transferError));
    } finally {
      setBusyKey(null);
    }
  };

  const handleShareBudget = async (next: boolean) => {
    setBusyKey("share-budget");
    setError(null);
    setNotice(null);
    try {
      await updateItinerary(itinerary.id, {
        share_budget: next,
        base_version: itinerary.version,
      });
      setNotice(next ? "Budget is now visible to viewers." : "Budget is now hidden from viewers.");
      await onChanged();
    } catch (shareError) {
      const conflict = apiConflict(shareError);
      if (conflict && onConflict) {
        onConflict(conflict.itinerary);
        setError("Someone else changed this trip. The latest version is being loaded.");
      } else {
        setError(apiError(shareError));
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateLink = async () => {
    setBusyKey("create-link");
    setError(null);
    setNotice(null);
    setNewLink(null);
    try {
      const created = await createInviteLink(itinerary.id, {
        role: linkRole,
        expires_in_days: linkExpiry === "" ? undefined : Number(linkExpiry),
        max_uses: linkUses === "" ? null : Number(linkUses),
      });
      setNewLink(created.invite_url);
      setLinks(await getInviteLinks(itinerary.id));
      setNotice("Share link created.");
    } catch (linkError) {
      setError(apiError(linkError));
    } finally {
      setBusyKey(null);
    }
  };

  const handleRevokeLink = async (link: ItineraryInvite) => {
    if (!window.confirm("Revoke this invite link? Anyone with it will lose access.")) return;
    setBusyKey(`revoke-${link.id}`);
    setError(null);
    try {
      await revokeInviteLink(itinerary.id, link.id);
      setLinks(await getInviteLinks(itinerary.id));
      setNotice("Invite link revoked.");
    } catch (linkError) {
      setError(apiError(linkError));
    } finally {
      setBusyKey(null);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Invite link copied.");
    } catch {
      setNotice("Could not copy automatically. Select the link to copy it.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isOwner ? "Share this trip" : "Trip members"}
      description={
        isOwner
          ? "Invite friends, set their role, and decide what they can see."
          : `You are a ${itinerary.my_role ?? "viewer"} on this trip.`
      }
      size="lg"
      busy={busyKey === "leave"}
    >
      {isOwner ? (
        <div className="mb-5 flex gap-1 rounded-full bg-sand-200/70 p-1" role="tablist" aria-label="Sharing sections">
          {([
            { id: "members", label: "Members" },
            { id: "invite", label: "Invite friends" },
            { id: "link", label: "Share link" },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                tab === item.id ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-ink-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <InlineError message={error} /> : null}
      {notice ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-surf-400/10 px-3 py-2 text-sm text-sea-600">
          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {loading ? <p className="py-6 text-center text-sm text-ink-600">Loading members...</p> : null}

      {!loading && tab === "members" ? (
        <div className="space-y-5">
          <ul className="space-y-1.5">
            {members.map((member) => {
              const isMe = member.id === user?.id;
              const pending = member.status === "pending";
              const isTripOwner = member.role === "owner";
              return (
                <li
                  key={member.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5",
                    isMe ? "bg-surf-400/10 ring-1 ring-inset ring-surf-400/25" : "hover:bg-sand-100/60",
                  )}
                >
                  <Avatar name={member.name} src={member.avatar_url ?? null} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {member.name}
                        {isMe ? " (you)" : ""}
                      </p>
                      {isTripOwner ? <Badge tone="surf">Owner</Badge> : null}
                      {pending ? <Badge tone="mango">Pending</Badge> : null}
                      {member.rsvp ? <Badge tone="neutral">{member.rsvp === "going" ? "Going" : member.rsvp === "maybe" ? "Maybe" : "Can't go"}</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-600">
                      {member.username ? `@${member.username}` : "LakBai traveller"}
                      {pending && member.invited_at ? ` · invited ${formatDateShort(member.invited_at.slice(0, 10))}` : ""}
                    </p>
                  </div>

                  {isOwner && !isTripOwner ? (
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={`Role for ${member.name}`}
                        value={member.role === "editor" ? "editor" : "viewer"}
                        onChange={(event) => void handleRole(member, event.target.value as "editor" | "viewer")}
                        disabled={busyKey !== null}
                        options={[
                          { value: "editor", label: "Editor" },
                          { value: "viewer", label: "Viewer" },
                        ]}
                        className="h-8 w-28 text-xs"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleRemove(member)}
                        disabled={busyKey !== null}
                        aria-label={pending ? `Cancel invite for ${member.name}` : `Remove ${member.name}`}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold text-ink-600">
                      {ROLE_LABEL[member.role]}
                    </span>
                  )}

                  {isMe && !isTripOwner ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmAction("leave")}
                      disabled={busyKey !== null}
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Leave
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {currentMember && currentMember.status === "accepted" && currentMember.role !== "owner" ? (
            <div className="rounded-2xl bg-sand-100/60 p-4">
              <p className="text-sm font-semibold text-ink-900">Your RSVP</p>
              <p className="mt-0.5 text-xs text-ink-600">Let the group know if you are still in.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  { value: "going", label: "I'm going" },
                  { value: "maybe", label: "Maybe" },
                  { value: "declined", label: "Can't make it" },
                ] as const).map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={currentMember.rsvp === option.value ? "primary" : "secondary"}
                    onClick={() => {
                      void (async () => {
                        setBusyKey("rsvp");
                        try {
                          const rows = await rsvpItinerary(itinerary.id, option.value);
                          setMembers(rows);
                          setNotice("RSVP updated.");
                          await onChanged();
                        } catch (rsvpError) {
                          setError(apiError(rsvpError));
                        } finally {
                          setBusyKey(null);
                        }
                      })();
                    }}
                    disabled={busyKey !== null}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {isOwner ? (
            <div className="space-y-4 border-t border-line/60 pt-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-sand-100/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Show budget to viewers</p>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {itinerary.share_budget
                      ? "Viewers can see the budget and stop estimates."
                      : "Budget and stop estimates are hidden from viewers."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(itinerary.share_budget)}
                  aria-label="Show budget to viewers"
                  onClick={() => void handleShareBudget(!itinerary.share_budget)}
                  disabled={busyKey !== null}
                  className={cn(
                    "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                    itinerary.share_budget ? "bg-surf-400" : "bg-sand-200",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      itinerary.share_budget ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>

              {acceptedMembers.length > 0 ? (
                <div className="rounded-2xl bg-lagoon-900 p-4 text-sand-50">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldIcon className="h-4 w-4" /> Transfer ownership
                  </p>
                  <p className="mt-1 text-xs text-sand-50/70">
                    You become an editor. This cannot be undone unless the new owner transfers it back.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Select
                      aria-label="New owner"
                      value={transferTo}
                      onChange={(event) => setTransferTo(event.target.value)}
                      options={acceptedMembers.map((member) => ({ value: String(member.id), label: member.name }))}
                      emptyLabel="Choose a member"
                      className="h-9 min-w-44 flex-1 bg-white/90 text-sm"
                    />
                    <Button
                      variant="sand"
                      size="sm"
                      disabled={!transferTo || busyKey !== null}
                      onClick={() => setConfirmAction("transfer")}
                    >
                      Transfer
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === "invite" && isOwner ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Invite accepted friends</p>
              <p className="text-xs text-ink-600">They will see the invite in their trips list.</p>
            </div>
            <Select
              label="Role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
              options={[
                { value: "editor", label: "Editor" },
                { value: "viewer", label: "Viewer" },
              ]}
              className="h-9 w-32 text-sm"
            />
          </div>
          <FriendPicker
            friends={friends}
            selected={invitees}
            onChange={setInvitees}
            loading={loading}
            idPrefix="share-friend"
          />
          <div className="flex justify-end">
            <Button onClick={() => void handleInvite()} disabled={invitees.length === 0 || busyKey !== null}>
              <FriendsIcon className="h-4 w-4" />
              {busyKey === "invite" ? "Sending..." : `Invite ${invitees.length || ""}`.trim()}
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && tab === "link" && isOwner ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-sand-100/60 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lagoon-900 text-sand-50">
                <ShareIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">Create a fallback link</p>
                <p className="mt-0.5 text-xs text-ink-600">
                  Use this when someone is not on your friends list. Links can be limited and revoked.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Select
                label="Role"
                value={linkRole}
                onChange={(event) => setLinkRole(event.target.value as "editor" | "viewer")}
                options={[
                  { value: "viewer", label: "Viewer" },
                  { value: "editor", label: "Editor" },
                ]}
                className="h-9 text-sm"
              />
              <Input
                label="Expires in days"
                type="number"
                min={0}
                max={30}
                value={linkExpiry}
                onChange={(event) => setLinkExpiry(event.target.value)}
                className="h-9 text-sm"
              />
              <Input
                label="Max uses"
                type="number"
                min={1}
                max={1000}
                value={linkUses}
                onChange={(event) => setLinkUses(event.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button className="mt-3" onClick={() => void handleCreateLink()} disabled={busyKey !== null}>
              {busyKey === "create-link" ? "Creating link..." : "Create share link"}
            </Button>
          </div>

          {newLink ? (
            <div className="rounded-2xl bg-lagoon-900 p-4 text-sand-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-surf-300">Copied once, saved nowhere else</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-black/20 px-3 py-2 text-xs">{newLink}</code>
                <Button variant="sand" size="sm" onClick={() => void copyLink(newLink)}>
                  <CopyIcon className="h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-semibold text-ink-900">Active links</p>
            {links.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-600">
                No share links yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/50 px-3 py-2 ring-1 ring-inset ring-line">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {ROLE_LABEL[link.role]} link
                        {link.revoked_at ? " · revoked" : link.is_redeemable === false ? " · expired" : ""}
                      </p>
                      <p className="text-xs text-ink-600">
                        {link.uses_count} {link.uses_count === 1 ? "use" : "uses"}
                        {link.max_uses ? ` of ${link.max_uses}` : ""}
                        {link.expires_at ? ` · expires ${new Date(link.expires_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    {!link.revoked_at && link.is_redeemable !== false ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleRevokeLink(link)}
                        disabled={busyKey !== null}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <Modal
        open={confirmAction === "leave"}
        onClose={() => setConfirmAction(null)}
        title="Leave this trip?"
        description="You will lose access to the planner and its stops. The owner can invite you again later."
        size="sm"
        busy={busyKey === "leave"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={busyKey === "leave"}>
              Stay
            </Button>
            <Button variant="danger" onClick={() => void handleLeave()} disabled={busyKey === "leave"}>
              {busyKey === "leave" ? "Leaving..." : "Leave trip"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">This does not delete the trip for everyone else.</p>
      </Modal>

      <Modal
        open={confirmAction === "transfer"}
        onClose={() => setConfirmAction(null)}
        title="Transfer ownership?"
        description="The new owner gets full control, including inviting and removing members."
        size="sm"
        busy={busyKey === "transfer"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={busyKey === "transfer"}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleTransfer()} disabled={busyKey === "transfer"}>
              {busyKey === "transfer" ? "Transferring..." : "Transfer ownership"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">You will stay on the trip as an editor.</p>
      </Modal>
    </Modal>
  );
}
