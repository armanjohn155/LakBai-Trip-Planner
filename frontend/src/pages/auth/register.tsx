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
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>
    </AuthShell>
  );
}