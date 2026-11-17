import { useState, type FormEvent } from "react";

import { Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { apiError, apiFieldErrors } from "@/lib/api";
import { AuthForm, AuthShell } from "@/pages/auth/auth-shell";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const redirectTarget = () => {
    const search = new URLSearchParams(location.search);
    const redirect = search.get("redirect");
    const fromState = (location.state as { from?: string } | null)?.from;
    const from = redirect || fromState;
    return from && from !== "/login" && from !== "/register" ? from : "/";
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await register(name, email, password);
      navigate(redirectTarget());
    } catch (err) {
      setError(apiError(err));
      setFieldErrors(apiFieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return <Navigate to={redirectTarget()} replace />;
  }

  return (
    <AuthShell
      title="Start your first trip"
      detail="An account keeps your maps and budget in one place."
      footerText="Already have an account?"
      footerTo="/login"
      footerLabel="Sign in"
    >
      <AuthForm onSubmit={submit} error={error} busy={busy} submitLabel="Create account">
        <Input
          label="Name"
          name="name"
          autoComplete="name"
          required
          value={name}
          error={fieldErrors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label="Confirm password"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </AuthForm>

      <div className="flex items-center gap-4 text-ink-600 text-sm mt-6">
        <div className="flex-1 border-t border-line" />
        <span className="shrink-0 whitespace-nowrap">Or continue with</span>
        <div className="flex-1 border-t border-line" />
      </div>

      <button
        type="button"
        onClick={() => {
          const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
          window.location.href = `${apiBase.replace(/\/$/, "")}/auth/google/redirect`;
        }}
        disabled={busy}
        aria-label="Sign up with Google"
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink-900 hover:bg-sand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surf-400 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.89 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.65H2.18v2.84C3.37 21.02 7.06 23 12 23z"/>
          <path fill="#F4B400" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12c0 1.77.43 3.45 1.18 4.79l3.66-2.7z"/>
          <path fill="#EA4335" d="M12 5.38v2.91c-1.71-.98-3.63-1.61-5.73-1.61-2.08 0-4.02.71-5.48 2.08l2.81 2.11c.96-.89 2.27-1.45 3.73-1.45 1.48 0 2.72.81 3.36 2.02l1.87-1.87C16.1 6.69 14.19 5.38 12 5.38z"/>
        </svg>
        Continue with Google
      </button>
    </AuthShell>
  );
}