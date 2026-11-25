import { useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { apiError } from "@/lib/api";
import { getMe } from "@/lib/api";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { loginWithToken: persistLogin, user } = useAuth();
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const errorMsg = params.get("error");
    if (errorMsg) return decodeURIComponent(errorMsg);
    if (!params.get("token")) return "No token received from Google sign-in.";
    return null;
  });
  const [busy, setBusy] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("token")) && !params.get("error");
  });

  const getRedirectTarget = () => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("redirect");
    return target && target.startsWith("/") && !target.startsWith("//") ? target : "/";
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const target = getRedirectTarget();

    if (token) {
      let cancelled = false;
      localStorage.setItem("suroy.token", token);
      getMe()
        .then((currentUser) => {
          if (cancelled) return;
          localStorage.setItem("suroy.user", JSON.stringify(currentUser));
          persistLogin({ user: currentUser, token });
          navigate(target, { replace: true });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(apiError(err));
          localStorage.removeItem("suroy.token");
          setBusy(false);
        });

      return () => {
        cancelled = true;
      };
    } else {
      // Clean the URL so a refresh doesn't re-show the error
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate, persistLogin]);

  if (user) {
    navigate(getRedirectTarget(), { replace: true });
    return null;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md glass rounded-3xl p-8 text-center">
        {busy ? (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sea-600 mx-auto mb-4" />
            <p className="text-sm text-ink-600">Signing you in with Google…</p>
          </>
        ) : error ? (
          <>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="text-sm font-semibold text-sea-500 hover:text-sea-600 underline"
            >
              Go back to sign in
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
