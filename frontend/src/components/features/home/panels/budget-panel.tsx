/**
 * "Budgeting" panel.
 *
 * Static preview of the budgeting screen built with React + Tailwind: amount
 * spent vs budget, a progress bar, quick actions, and a list of trip expenses.
 * Renders from typed constants — no API, no auth, no interactivity.
 *
 * Sized to fit inside the carousel panel wrapper (overflow-hidden, fixed panel
 * heights). The card uses max-h-full + min-h-0 so it can shrink on short panels,
 * and clamp()-based font sizes so nothing clips at phone, tablet, or desktop.
 */

import type { ComponentType } from "react";

// ── Typed constants (single source of truth) ──────────────────────────────
const BUDGET = 5000;
const SPENT = 2335.20;

interface Expense {
  title: string;
  subtitle: string;
  Icon: ComponentType<{ className?: string }>;
}

const EXPENSES: Expense[] = [
  { title: "Cordova to Kawasan Falls", subtitle: "115km away", Icon: ScooterIcon },
  { title: "Cordova to Balwarte ni Alfredo", subtitle: "49km away", Icon: ForkKnifeIcon },
  { title: "Cordova to NUSTAR Resort Cebu", subtitle: "14.6km away", Icon: BedIcon },
];

export function BudgetPanel() {
  const fillWidth = `${(SPENT / BUDGET) * 100}%`;

  return (
    <div
      className="flex h-full w-full items-center justify-center p-2 sm:p-3 lg:p-5"
      role="img"
      aria-label="Preview of the budgeting screen showing ₱2335.20 spent of a ₱5,000 budget and three trip expenses"
    >
      <article
        className="w-full max-w-[36rem] max-h-full min-h-0 bg-white rounded-[1.75rem] shadow-[0_8px_24px_rgba(30,42,74,0.08)] border border-white/60 p-3 sm:p-4 lg:p-6 overflow-hidden"
      >
        {/* ── Header row ───────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4 mb-4 sm:mb-5">
          <h2
            className="font-brand font-normal tracking-tight text-lagoon-900"
            style={{ fontSize: "clamp(1.1rem, 3vw, 1.5rem)" }}
          >
            Budgeting
          </h2>
          <div
            className="flex h-9 shrink-0 items-center justify-center rounded-full bg-surf-400 px-3 py-1 text-[clamp(0.7rem,2vw,0.8rem)] font-semibold text-white shadow-[0_4px_6px_rgba(20,184,166,0.35)]"
          >
            <PlusIcon className="h-3.5 w-3.5 mr-1" />
            <span>Add expense</span>
          </div>
        </header>

        {/* ── Summary box ──────────────────────────────────────────── */}
        <section className="rounded-2xl bg-gray-200 p-3 sm:p-4 mb-5 sm:mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="font-display font-normal tracking-tight text-ink-900"
                  style={{ fontSize: "clamp(1.5rem, 5vw, 2.25rem)" }}
                >
                  ₱{SPENT.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-ink-600">
                  Budget: ₱{BUDGET.toFixed(0)}
                </span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-gray-300 overflow-hidden">
                <div className="h-full bg-surf-400 rounded-full" style={{ width: fillWidth }} />
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-gray-300 px-3 text-xs font-semibold text-ink-900">
                  <PencilIcon className="h-3.5 w-3.5 mr-1.5 text-ink-900" /> Edit budget
                </span>
                <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-gray-300 px-3 text-xs font-semibold text-ink-900">
                  <MoneyBagIcon className="h-3.5 w-3.5 mr-1.5 text-ink-900" /> Debt summary
                </span>
              </div>
            </div>

            <div className="hidden sm:flex flex-col gap-3 border-l border-gray-400 pl-6">
              <SummaryItem Icon={ViewIcon} label="View breakdown" />
              <SummaryItem Icon={TripmateIcon} label="Add tripmate" />
              <SummaryItem Icon={SettingsIcon} label="Settings" />
            </div>
          </div>
        </section>

        {/* ── Expenses section ─────────────────────────────────────── */}
        <section className="min-h-0">
          <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4">
            <h3
              className="font-brand font-normal tracking-tight text-lagoon-900"
              style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)" }}
            >
              Expenses
            </h3>
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
              <span>Sort: Date</span>
              <CaretDownIcon className="h-3.5 w-3.5 text-ink-600" />
            </div>
          </div>

          <ul className="divide-y divide-gray-300">
            {EXPENSES.map((expense) => (
              <li key={expense.title} className="flex items-start gap-3 py-2 sm:py-3">
                <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-ink-600">
                  <expense.Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p
                    className="font-brand font-normal text-sm sm:text-base text-ink-900 leading-none"
                    style={{ fontSize: "clamp(0.85rem, 2.5vw, 1rem)" }}
                  >
                    {expense.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-600">{expense.subtitle}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}

// ── Non-interactive summary item (fake link in the preview) ──────────────
function SummaryItem({ Icon, label }: { Icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-ink-700" />
      <span className="text-xs text-ink-600">{label}</span>
    </div>
  );
}

// ── Local SVG icons (viewBox 0 0 24 24, stroke currentColor, round caps) ──
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

function MoneyBagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9v5h1v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V16h1V9H3z" />
      <path d="M12 13v-2" />
      <path d="M12 13v2" />
    </svg>
  );
}

function ViewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M3 12h4M21 12h-4M12 21v-4M5.64 5.64l1.41 1.41M18.95 18.95l-1.41 1.41M5.64 18.95l1.41-1.41M18.95 5.64l-1.41-1.41" />
    </svg>
  );
}

function TripmateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <path d="M15 2v2M12 7h6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.21 12.09A7 7 0 0 0 20 10c0-1.1-.5-2.1-1.31-2.8M8 14h.01M16 14h.01M12 10h.01M12 18h.01M16.37 16.37l.71.71M4.93 4.93l.71.71M21.21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9 9 9 0 0 1 9 9z" />
    </svg>
  );
}

function ScooterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 11h17l-2 6H4l-2-6z" />
      <circle cx="6" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M7 11v4H6v-4zM17 11v4h1v-4z" />
    </svg>
  );
}

function ForkKnifeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 4l-2.5 2.5M4 11l2-2M8 5l2 5M16 5l-2 5M13 19l-3-3M13 19l3-3" />
    </svg>
  );
}

function BedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 11v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2M5 16h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1zM15 16h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1z" />
    </svg>
  );
}

function CaretDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 9l-6 6-6-6" />
    </svg>
  );
}
