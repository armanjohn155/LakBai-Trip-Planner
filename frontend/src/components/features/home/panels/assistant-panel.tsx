/**
 * "Assistant" panel — placeholder until the real assistant design exists.
 * The root element fills the same panel card as the image panels, so the
 * carousel height stays consistent.
 */
export function AssistantPanel() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[#9CA3AF]/40 bg-white/85 p-8 text-center shadow-[0_8px_24px_rgba(30,42,74,0.08)] sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full  text-[#1E2A4A]">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </span>

        <h4 className="mt-4 font-display text-2xl font-semibold text-lagoon-900">Coming soon</h4>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          The trip assistant is still being built. Soon it&apos;ll help you choose stops, estimate costs, and
          shape an itinerary around your budget.
        </p>
      </div>
    </div>
  );
}
