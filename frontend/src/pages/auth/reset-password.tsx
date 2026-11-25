import { useState, type FormEvent } from "react";

import { Link, Navigate, useSearchParams } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiError, apiFieldErrors, resetPassword } from "@/lib/api";
import { AuthForm, AuthShell } from "@/pages/auth/auth-shell";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const tokenParam = searchParams.get("token") ?? "";
  const emailParam = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const tokenMissing = !tokenParam;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      await resetPassword({
        token: tokenParam,
        email,
        password,
        password_confirmation: confirm,
      });
      setSuccess(true);
    } catch (err) {
      setError(apiError(err));
      setFieldErrors(apiFieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  if (success) {
    return (
      <AuthShell
        title="Password updated"
        detail="Your password has been reset successfully."
        footerText="Ready to sign in?"
        footerTo="/login"
        footerLabel="Sign in"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-4 text-sm text-ink-700">
            <p className="font-medium text-emerald-900">All set!</p>
            <p className="mt-1 text-xs text-ink-600">
              You can now use your new password to sign in to your Lakbai account.
            </p>
          </div>

          <Link to="/login" className="block pt-2">
            <Button className="w-full" size="lg">
              Proceed to sign in
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (tokenMissing) {
    return (
      <AuthShell
        title="Invalid reset link"
        detail="This password reset link is invalid or incomplete."
        footerText="Remember your password?"
        footerTo="/login"
        footerLabel="Sign in"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 text-sm text-amber-900">
            <p className="font-medium">Reset token is missing</p>
            <p className="mt-1 text-xs text-amber-800">
              The reset token could not be found in the link. Please request a new password reset link.
            </p>
          </div>

          <Link to="/forgot-password" className="block pt-2">
            <Button className="w-full" size="lg">
              Request a new reset link
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create new password"
      detail="Choose a strong password with at least 8 characters."
      footerText="Remember your password?"
      footerTo="/login"
      footerLabel="Sign in"
    >
      <AuthForm onSubmit={submit} error={error} busy={busy} submitLabel="Update password">
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label="Confirm new password"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Re-enter your new password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </AuthForm>
    </AuthShell>
  );
}
