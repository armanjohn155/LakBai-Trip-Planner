import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { CheckIcon, FriendsIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { useAuth } from "@/hooks/use-auth";
import { acceptInvite, apiError, getInvitePreview, sendFriendRequest } from "@/lib/api";
import type { InvitePreview } from "@/lib/types";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "accepting" | "accepted">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedTripId, setAcceptedTripId] = useState<number | null>(null);
  const [friendState, setFriendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [friendMessage, setFriendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => {
        setStatus("error");
        setMessage("Invalid invite link.");
      });
      return;
    }

    if (loading) return;

    if (!user) {
      navigate(`/login?redirect=/invite/${token}`, { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await getInvitePreview(token);
        if (!cancelled) {
          setPreview(data);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(apiError(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user, loading, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    setStatus("accepting");
    setMessage(null);
    try {
      const res = await acceptInvite(token);
      const itineraryId = res.data?.itinerary_id ?? preview?.itinerary_id ?? null;
      setAcceptedTripId(itineraryId);
      setStatus("accepted");
    } catch (err) {
      setStatus("error");
      setMessage(apiError(err));
    }
  };

  const handleFriendRequest = async () => {
    const identifier = preview?.owner?.username ?? preview?.owner_username;
    if (!identifier) return;
    setFriendState("sending");
    setFriendMessage(null);
    try {
      await sendFriendRequest(identifier);
      setFriendState("sent");
    } catch (err) {
      setFriendState("error");
      setFriendMessage(apiError(err));
    }
  };

  const ownerName = preview?.owner?.name ?? preview?.owner_name ?? "The trip owner";
  const ownerUsername = preview?.owner?.username ?? preview?.owner_username ?? null;
  const ownerAvatar = preview?.owner?.avatar_url ?? null;

  const openTrip = () => {
    navigate(acceptedTripId ? `/app/trips/${acceptedTripId}` : "/app/trips", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-12">
      <div className="w-full overflow-hidden rounded-3xl bg-white/90 shadow-xl shadow-lagoon-950/5 ring-1 ring-inset ring-line">
        <div className="bg-lagoon-900 px-6 py-6 text-sand-50">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surf-300">LakBai trip invite</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {status === "accepted" ? "You're in!" : status === "error" ? "Invite unavailable" : "Join this trip"}
          </h1>
          {status === "ready" || status === "accepting" || status === "accepted" ? (
            <p className="mt-1 text-sm text-sand-50/75">{preview?.itinerary_name}</p>
          ) : null}
        </div>

        <div className="p-6">
          {status === "loading" ? <p className="text-sm text-ink-600">Loading invite...</p> : null}

          {status === "error" ? (
            <div className="space-y-4">
              <InlineError message={message ?? "This invite may have expired or been revoked."} />
              <Button variant="secondary" onClick={() => navigate("/app/trips", { replace: true })}>
                Go to my trips
              </Button>
            </div>
          ) : null}

          {(status === "ready" || status === "accepting") && preview ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl bg-sand-100/60 p-4">
                <Avatar name={ownerName} src={ownerAvatar} className="h-12 w-12 text-base" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-600">Invited by</p>
                  <p className="truncate font-semibold text-ink-900">{ownerName}</p>
                  {ownerUsername ? <p className="truncate text-xs text-ink-500">@{ownerUsername}</p> : null}
                </div>
                <Badge tone="surf">{preview.role === "editor" ? "Editor" : "Viewer"}</Badge>
              </div>

              <div className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
                <p className="rounded-xl bg-sand-100/50 px-3 py-2">
                  Role: <span className="font-semibold text-ink-900">{preview.role === "editor" ? "Can edit the plan" : "View only"}</span>
                </p>
                <p className="rounded-xl bg-sand-100/50 px-3 py-2">
                  Group: <span className="font-semibold text-ink-900">{preview.member_count ?? "Just the owner"} travellers</span>
                </p>
                {preview.expires_at ? (
                  <p className="rounded-xl bg-sand-100/50 px-3 py-2 sm:col-span-2">
                    Expires: <span className="font-semibold text-ink-900">{new Date(preview.expires_at).toLocaleString()}</span>
                  </p>
                ) : null}
              </div>

              <p className="text-sm text-ink-600">
                Accepting adds this trip to your trips list. You can leave at any time from the members panel.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => void handleAccept()} disabled={status === "accepting"}>
                  <CheckIcon className="h-4 w-4" />
                  {status === "accepting" ? "Joining..." : "Accept invite"}
                </Button>
                <Button variant="secondary" onClick={() => navigate("/app/trips", { replace: true })} disabled={status === "accepting"}>
                  Not now
                </Button>
              </div>
            </div>
          ) : null}

          {status === "accepted" && preview ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl bg-surf-400/10 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surf-400 text-white">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900">{preview.itinerary_name}</p>
                  <p className="mt-0.5 text-sm text-ink-600">
                    Added to your trips as {preview.role === "editor" ? "an editor" : "a viewer"}.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line/70 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <FriendsIcon className="h-4 w-4" /> Keep in touch with {ownerName}
                </p>
                <p className="mt-1 text-xs text-ink-600">
                  Making friends lets {ownerName} invite you to future trips without a link.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleFriendRequest()}
                    disabled={!ownerUsername || friendState === "sending" || friendState === "sent"}
                  >
                    <FriendsIcon className="h-4 w-4" />
                    {friendState === "sent" ? "Friend request sent" : friendState === "sending" ? "Sending..." : "Add as friend"}
                  </Button>
                  {!ownerUsername ? <span className="text-xs text-ink-500">No username available.</span> : null}
                </div>
                {friendMessage ? <p className="mt-2 text-xs text-red-600">{friendMessage}</p> : null}
              </div>

              <Button className="w-full" onClick={openTrip}>
                Open trip planner
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
