import { useState, type FormEvent } from "react";

import { Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { AuthForm, AuthShell } from "@/pages/auth/auth-shell";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = () => {
    const from = (location.state as { from?: string } | null)?.from;
    return from && from !== "/login" && from !== "/register" ? from : "/";
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(redirectTarget());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return <Navigate to={redirectTarget()} replace />;
  }

  return (
    <AuthShell
      title="Back to the island"
      detail="Sign in to pick up your trips."
      footerText="New to Lakbai?"
      footerTo="/register"
      footerLabel="Create an account"
    >
      <AuthForm onSubmit={submit} error={error} busy={busy} submitLabel="Sign in">
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </AuthForm>
    </AuthShell>
  );
}