import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { CheckIcon, CopyIcon, FriendsIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, InlineError, Spinner } from "@/components/ui/feedback";
import { FieldHint, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  acceptFriendRequest,
  apiError,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  getBlockedUsers,
  getFriendCode,
  getFriendRequests,
  getFriends,
  regenerateFriendCode,
  sendFriendRequest,
  unfriend,
  unblockUser,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type { FriendCode, Friendship, FriendUser } from "@/lib/types";

type Tab = "friends" | "requests" | "add" | "blocked";

const TABS: { id: Tab; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "add", label: "Add friend" },
  { id: "blocked", label: "Blocked" },
];

type ConfirmAction =
  | { type: "unfriend"; user: FriendUser }
  | { type: "block"; user: FriendUser }
  | { type: "regenerate" };

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [outgoing, setOutgoing] = useState<Friendship[]>([]);
  const [blocked, setBlocked] = useState<Friendship[]>([]);
  const [friendCode, setFriendCode] = useState<FriendCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [friendsData, incomingData, outgoingData, blockedData, codeData] = await Promise.all([
        getFriends(),
        getFriendRequests("incoming"),
        getFriendRequests("outgoing"),
        getBlockedUsers(),
        getFriendCode(),
      ]);

      setFriends(friendsData);
      setIncoming(incomingData);
      setOutgoing(outgoingData);
      setBlocked(blockedData);
      setFriendCode(codeData);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = async () => {
    setLoading(true);
    await load();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredFriends = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter(
      (friend) => friend.name.toLowerCase().includes(term) || friend.username?.toLowerCase().includes(term),
    );
  }, [friends, query]);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || sending) return;

    setSending(true);
    setAddSuccess(null);
    try {
      const response = await sendFriendRequest(identifier.trim());
      setAddSuccess(response.message);
      setIdentifier("");
      const [incomingData, outgoingData] = await Promise.all([
        getFriendRequests("incoming"),
        getFriendRequests("outgoing"),
      ]);
      setIncoming(incomingData);
      setOutgoing(outgoingData);
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (request: Friendship) => {
    setBusyId(`accept-${request.id}`);
    try {
      await acceptFriendRequest(request.id);
      setIncoming((current) => current.filter((item) => item.id !== request.id));
      setToast("Friend request accepted.");
      setTab("friends");
      const friendsData = await getFriends();
      setFriends(friendsData);
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (request: Friendship) => {
    setBusyId(`decline-${request.id}`);
    try {
      await declineFriendRequest(request.id);
      setIncoming((current) => current.filter((item) => item.id !== request.id));
      setToast("Friend request declined.");
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (request: Friendship) => {
    setBusyId(`cancel-${request.id}`);
    try {
      await cancelFriendRequest(request.id);
      setOutgoing((current) => current.filter((item) => item.id !== request.id));
      setToast("Friend request cancelled.");
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleUnblock = async (user: FriendUser) => {
    setBusyId(`unblock-${user.id}`);
    try {
      await unblockUser(user.id);
      setBlocked((current) => current.filter((item) => item.user?.id !== user.id));
      setToast(`${user.name} unblocked.`);
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const copyFriendCode = async () => {
    const code = friendCode?.friend_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setToast("Friend code copied.");
    } catch {
      setToast("Could not copy the friend code. Select it manually.");
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;

    const action = confirm;
    setBusyId(`confirm-${action.type}`);

    try {
      if (action.type === "unfriend") {
        await unfriend(action.user.id);
        setFriends((current) => current.filter((item) => item.id !== action.user.id));
        setToast(`${action.user.name} removed from your friends.`);
      } else if (action.type === "block") {
        await blockUser(action.user.id);
        setFriends((current) => current.filter((item) => item.id !== action.user.id));
        setIncoming((current) => current.filter((item) => item.user?.id !== action.user.id));
        setOutgoing((current) => current.filter((item) => item.user?.id !== action.user.id));
        setToast(`${action.user.name} blocked.`);
        const blockedData = await getBlockedUsers();
        setBlocked(blockedData);
      } else {
        const response = await regenerateFriendCode();
        setFriendCode(response.data);
        setToast("Friend code regenerated.");
      }

      setConfirm(null);
    } catch (err) {
      setToast(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmTitle =
    confirm?.type === "unfriend"
      ? `Remove ${confirm.user.name}?`
      : confirm?.type === "block"
        ? `Block ${confirm.user.name}?`
        : "Regenerate your friend code?";

  const confirmDescription =
    confirm?.type === "unfriend"
      ? "You will no longer appear in each other's friends list. Shared trips are not affected."
      : confirm?.type === "block"
        ? "This removes your friendship and any pending requests. They will not be able to send you a new request."
        : "Your current code will stop working immediately. Anyone you share it with will need the new one.";

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-16 text-sm text-ink-600">
        <Spinner className="h-4 w-4" /> Loading your friends…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-lagoon-900">Friends</h1>
          <p className="mt-1 text-sm text-ink-600">Travel companions you trust, all in one place.</p>
        </div>
        <Button onClick={() => setTab("add")}>
          <PlusIcon className="h-4 w-4" />
          Add friend
        </Button>
      </div>

      {error ? (
        <div className="space-y-3">
          <InlineError message={error} />
          <Button variant="secondary" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : null}

      <Card className="glass-frost flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-600">My friend code</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.12em] text-lagoon-900">
            {friendCode?.friend_code ?? "—"}
          </p>
          <p className="mt-1 text-sm text-ink-600">Share this code so a friend can add you directly.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void copyFriendCode()} disabled={!friendCode?.friend_code}>
            <CopyIcon className="h-4 w-4" />
            Copy
          </Button>
          <Button variant="secondary" onClick={() => setConfirm({ type: "regenerate" })}>
            Regenerate
          </Button>
        </div>
      </Card>

      <div className="flex overflow-x-auto rounded-full bg-sand-200/70 p-1" role="tablist" aria-label="Friends sections">
        {TABS.map((item) => {
          const count = item.id === "friends" ? friends.length : item.id === "blocked" ? blocked.length : item.id === "requests" ? incoming.length + outgoing.length : 0;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                tab === item.id ? "bg-white text-lagoon-900 shadow-sm" : "text-ink-600 hover:text-lagoon-900",
              )}
            >
              {item.label}
              {count > 0 ? <Badge tone={item.id === "requests" ? "mango" : "neutral"}>{count}</Badge> : null}
            </button>
          );
        })}
      </div>

      {tab === "friends" ? (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
            <Input
              aria-label="Search friends"
              placeholder="Search your friends"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          {friends.length === 0 ? (
            <EmptyState
              title="No friends yet"
              detail="Add someone by username, friend code, or email to start planning together."
              action={
                <Button className="mt-2" onClick={() => setTab("add")}>
                  Add your first friend
                </Button>
              }
            />
          ) : filteredFriends.length === 0 ? (
            <EmptyState title="No matches" detail={`Nobody in your friends list matches “${query.trim()}”.`} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filteredFriends.map((friend) => (
                <li key={friend.id}>
                  <Card className="flex h-full flex-wrap items-center gap-3 p-4">
                    <Avatar name={friend.name} src={friend.avatar_url ?? null} className="h-12 w-12 text-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-lagoon-900">{friend.name}</p>
                      <p className="truncate text-sm text-ink-600">{friend.username ? `@${friend.username}` : "Lakbai traveller"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setConfirm({ type: "unfriend", user: friend })}>
                        Unfriend
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm({ type: "block", user: friend })}>
                        Block
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-lagoon-900">Incoming</h2>
              {incoming.length > 0 ? <Badge tone="mango">{incoming.length}</Badge> : null}
            </div>

            {incoming.length === 0 ? (
              <EmptyState title="No incoming requests" detail="New friend requests will show up here." />
            ) : (
              <ul className="space-y-3">
                {incoming.map((request) => (
                  <li key={request.id}>
                    <Card className="flex flex-wrap items-center gap-3 p-4">
                      <Avatar name={request.user?.name ?? "Traveller"} src={request.user?.avatar_url ?? null} className="h-11 w-11 text-base" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-lagoon-900">{request.user?.name ?? "Traveller"}</p>
                        <p className="truncate text-sm text-ink-600">{request.user?.username ? `@${request.user.username}` : "Lakbai traveller"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleAccept(request)}
                          disabled={busyId === `accept-${request.id}` || busyId === `decline-${request.id}`}
                        >
                          {busyId === `accept-${request.id}` ? <Spinner className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleDecline(request)}
                          disabled={busyId === `accept-${request.id}` || busyId === `decline-${request.id}`}
                        >
                          {busyId === `decline-${request.id}` ? <Spinner className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                          Decline
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-lagoon-900">Outgoing</h2>
              {outgoing.length > 0 ? <Badge>{outgoing.length}</Badge> : null}
            </div>

            {outgoing.length === 0 ? (
              <EmptyState title="No sent requests" detail="Requests you send will stay here until they are answered." />
            ) : (
              <ul className="space-y-3">
                {outgoing.map((request) => (
                  <li key={request.id}>
                    <Card className="flex flex-wrap items-center gap-3 p-4">
                      <Avatar name={request.user?.name ?? "Traveller"} src={request.user?.avatar_url ?? null} className="h-11 w-11 text-base" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-lagoon-900">{request.user?.name ?? "Traveller"}</p>
                        <p className="truncate text-sm text-ink-600">{request.user?.username ? `@${request.user.username}` : "Lakbai traveller"}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => void handleCancel(request)} disabled={busyId === `cancel-${request.id}`}>
                        {busyId === `cancel-${request.id}` ? <Spinner className="h-3.5 w-3.5" /> : null}
                        Cancel
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "add" ? (
        <Card className="glass-frost max-w-2xl p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surf-400/15 text-sea-600">
              <FriendsIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-lagoon-900">Send a friend request</h2>
              <p className="text-sm text-ink-600">Exact match only — no browsing or partial matches.</p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={(event) => void submitRequest(event)}>
            <Input
              label="Username, friend code, or email"
              placeholder="e.g. maria_santos, LAKBAI-7K3P9Q, or friend@example.com"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setAddSuccess(null);
              }}
              autoComplete="off"
              required
            />
            <FieldHint>We only look for an exact username, friend code, or email address.</FieldHint>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={sending || identifier.trim() === ""}>
                {sending ? <Spinner className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                Send request
              </Button>
              {addSuccess ? (
                <p role="status" className="text-sm font-medium text-emerald-700">
                  {addSuccess}
                </p>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "blocked" ? (
        <div className="space-y-4">
          {blocked.length === 0 ? (
            <EmptyState title="Nobody is blocked" detail="Blocked travellers cannot send you friend requests." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {blocked.map((entry) => {
                const user = entry.user;
                if (!user) return null;

                return (
                  <li key={entry.id}>
                    <Card className="flex items-center gap-3 p-4">
                      <Avatar name={user.name} src={user.avatar_url ?? null} className="h-11 w-11 text-base" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-lagoon-900">{user.name}</p>
                        <p className="truncate text-sm text-ink-600">{user.username ? `@${user.username}` : "Lakbai traveller"}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => void handleUnblock(user)} disabled={busyId === `unblock-${user.id}`}>
                        {busyId === `unblock-${user.id}` ? <Spinner className="h-3.5 w-3.5" /> : null}
                        Unblock
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <Modal
        open={Boolean(confirm)}
        onClose={() => {
          if (!busyId?.startsWith("confirm-")) setConfirm(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        size="sm"
        busy={Boolean(busyId?.startsWith("confirm-"))}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={Boolean(busyId?.startsWith("confirm-"))}>
              Cancel
            </Button>
            <Button
              variant={confirm?.type === "regenerate" ? "primary" : "danger"}
              onClick={() => void runConfirm()}
              disabled={Boolean(busyId?.startsWith("confirm-"))}
            >
              {busyId?.startsWith("confirm-") ? <Spinner className="h-4 w-4" /> : null}
              {confirm?.type === "unfriend" ? "Unfriend" : confirm?.type === "block" ? "Block" : "Regenerate"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {confirm?.type === "block"
            ? "Blocking is private. They will not be told that you blocked them."
            : "You can change this later from the Friends page."}
        </p>
      </Modal>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-[1300] max-w-sm rounded-xl bg-lagoon-900 px-4 py-3 text-sm font-medium text-sand-50 shadow-lg" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
