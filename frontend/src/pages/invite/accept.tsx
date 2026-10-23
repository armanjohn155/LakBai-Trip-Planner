import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { acceptInvite, apiError, getInvitePreview } from "@/lib/api";
import type { InvitePreview } from "@/lib/types";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "accepting">("loading");
  const [message, setMessage] = useState<string | null>(null);

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
    try {
      const res = await acceptInvite(token);
      const itineraryId = res.data?.itinerary_id;
      navigate(itineraryId ? `/app/trips/${itineraryId}` : "/app/trips", { replace: true });
    } catch (err) {
      setStatus("error");
      setMessage(apiError(err));
    }
  };

  const handleDecline = () => {
    navigate("/app/trips", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full rounded-3xl border border-black/5 bg-white/90 p-8 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Itinerary invitation</h1>
        {status === "loading" && <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading invite...</p>}
        {status === "ready" && preview && (
          <div className="mt-6 space-y-4">
            <p className="text-base text-[var(--text-primary)]">
              You've been invited to collaborate on <span className="font-semibold">{preview.itinerary_name}</span>
            </p>
            <div className="rounded-2xl bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">
              <div>Owner: {preview.owner_name || "—"}</div>
              <div>Role: {preview.role === "editor" ? "Editor" : "Viewer"}</div>
              {preview.member_count ? <div>Members: {preview.member_count}</div> : null}
              {preview.expires_at ? <div>Expires: {new Date(preview.expires_at).toLocaleString()}</div> : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={handleAccept} disabled={status !== "ready"}>
                Accept
              </Button>
              <Button variant="ghost" onClick={handleDecline} disabled={status !== "ready"}>
                Decline
              </Button>
            </div>
          </div>
        )}
        {message && (status === "error" || status === "accepting") ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
