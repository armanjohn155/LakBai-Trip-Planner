import { useState, type FormEvent } from "react";

import { Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
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

  const redirectTarget = () => {
    const from = (location.state as { from?: string } | null)?.from;
    return from && from !== "/login" && from !== "/register" ? from : "/";
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await register(name, email, password);
      navigate(redirectTarget());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Try again.");
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
        <Input label="Name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        <Input label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </AuthForm>
    </AuthShell>
  );
}