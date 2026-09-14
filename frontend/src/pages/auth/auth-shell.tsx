import type { FormEvent, ReactNode } from "react";

import { Link } from "react-router";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";

interface AuthShellProps {
  title: string;
  detail: string;
  children: ReactNode;
  footerText: string;
  footerTo: string;
  footerLabel: string;
}

export function AuthShell({ title, detail, children, footerText, footerTo, footerLabel }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-[0_1px_2px_rgba(7,31,37,0.06)] ring-1 ring-line">
            <h1 className="font-display text-3xl font-semibold text-lagoon-900">{title}</h1>
            <p className="mt-2 text-sm text-ink-600">{detail}</p>
            <div className="mt-6 space-y-5">{children}</div>
            <p className="mt-6 text-center text-sm text-ink-600">
              {footerText}{" "}
              <Link to={footerTo} className="font-semibold text-sea-500 hover:text-sea-600">
                {footerLabel}
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

interface AuthFormProps {
  onSubmit: (event: FormEvent) => void;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  children: ReactNode;
}

export function AuthForm({ onSubmit, error, busy, submitLabel, children }: AuthFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {children}
      {error ? <InlineError message={error} /> : null}
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}