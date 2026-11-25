import { useState, type FormEvent } from "react";

import { Link, Navigate } from "react-router";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiError, apiFieldErrors, forgotPassword } from "@/lib/api";
import { AuthForm, AuthShell } from "@/pages/auth/auth-shell";

export default function ForgotPasswordPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);

    try {
      await forgotPassword({ email });
      setSubmittedEmail(email);
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

  if (submittedEmail) {
    return (
      <AuthShell
        title="Check your email"
        detail="We've sent password reset instructions to your inbox."
        footerText="Remember your password?"
        footerTo="/login"
        footerLabel="Sign in"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-sea-50/70 border border-sea-200/80 p-4 text-sm text-ink-700">
            <p>
              A password reset link was sent to{" "}
              <strong className="font-semibold text-ink-900">{submittedEmail}</strong>.
            </p>
            <p className="mt-2 text-xs text-ink-600">
              Please check your inbox (and spam or junk folder). The link will expire in 60 minutes.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSubmittedEmail(null);
                setError(null);
              }}
            >
              Try another email address
            </Button>
            <Link to="/login" className="block text-center text-sm font-semibold text-sea-500 hover:text-sea-600 py-2">
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      detail="Enter your account email and we'll send you a password reset link."
      footerText="Remember your password?"
      footerTo="/login"
      footerLabel="Sign in"
    >
      <AuthForm onSubmit={submit} error={error} busy={busy} submitLabel="Send reset link">
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </AuthForm>
    </AuthShell>
  );
}
