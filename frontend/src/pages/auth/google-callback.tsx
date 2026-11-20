import { useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { apiError } from "@/lib/api";
import { getMe } from "@/lib/api";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { loginWithToken: persistLogin, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const errorMsg = params.get("error");

    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      // Clean the URL so a refresh doesn't re-show the error
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (token) {
      completeLogin(token);
    } else {
      setError("No token received from Google sign-in.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const completeLogin = async (token: string) => {
    setBusy(true);
    try {
      // Store the token the same way email/password login does
      localStorage.setItem("suroy.token", token);

      // Fetch the user profile
      const currentUser = await getMe();
      localStorage.setItem("suroy.user", JSON.stringify(currentUser));

      // Notify the auth context
      persistLogin({ user: currentUser, token });

      navigate("/", { replace: true });
    } catch (err) {
      setError(apiError(err));
      localStorage.removeItem("suroy.token");
      setBusy(false);
    } finally {
      if (!error) setBusy(false);
    }
  };

  if (user) {
    navigate("/", { replace: true });
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
