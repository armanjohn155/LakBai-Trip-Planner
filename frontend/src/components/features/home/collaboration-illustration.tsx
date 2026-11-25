import { cn } from "@/lib/cn";

interface CollaborationIllustrationProps {
  className?: string;
}

export function CollaborationIllustration({ className }: CollaborationIllustrationProps) {
  const avatars = [
    { initials: "NV", bg: "bg-lagoon-700 text-white", name: "Nico" },
    { initials: "OM", bg: "bg-amber-600 text-white", name: "Olivia" },
    { initials: "HY", bg: "bg-surf-600 text-white", name: "Harry" },
    { initials: "PX", bg: "bg-indigo-600 text-white", name: "Peter" },
  ];

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-sand-50 via-white to-surf-400/10 p-3 sm:p-5 select-none",
        className,
      )}
      role="img"
      aria-label="Illustration of friends collaborating on an itinerary with avatars and activity details"
    >
      <div className="w-full max-w-[22rem] sm:max-w-[24rem] rounded-2xl border border-line/70 bg-white/95 p-3 sm:p-4 shadow-[0_8px_20px_rgba(10,51,48,0.08)] backdrop-blur-sm">
        {/* Top bar: Trip name & Avatars */}
        <div className="flex items-center justify-between border-b border-line/60 pb-2.5 sm:pb-3">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-sea-600">Trip Plan</p>
            <p className="truncate text-xs sm:text-sm font-bold text-lagoon-900">South Cebu Expedition</p>
          </div>

          {/* Avatar stack: NV, OM, HY, PX */}
          <div className="flex items-center -space-x-1.5 sm:-space-x-2">
            {avatars.map((avatar) => (
              <span
                key={avatar.initials}
                title={avatar.name}
                className={cn(
                  "flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold shadow-sm ring-2 ring-white",
                  avatar.bg,
                )}
              >
                {avatar.initials}
              </span>
            ))}
          </div>
        </div>

        {/* Activity & Stop Row */}
        <div className="mt-2.5 sm:mt-3 space-y-2">
          {/* Main collaboration item */}
          <div className="relative rounded-xl border border-surf-400/30 bg-surf-400/5 p-2 sm:p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-surf-400 text-white text-[10px] sm:text-xs font-bold">
                  1
                </span>
                <span className="truncate text-xs sm:text-sm font-semibold text-lagoon-900">
                  Kawasan Falls
                </span>
              </div>
              <span className="shrink-0 text-[10px] sm:text-xs text-ink-600">Day 1</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-surf-400/15">
              <span className="text-[10px] sm:text-xs font-medium text-ink-700 inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Added by Harry
              </span>

              {/* "Approved by Peter" tooltip/badge */}
              <span
                className="inline-flex items-center gap-1 rounded-md bg-lagoon-900 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-sand-50 shadow-sm"
                title="Approved by Peter"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-emerald-400 shrink-0" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
                Approved by Peter
              </span>
            </div>
          </div>

          {/* Secondary collaboration item */}
          <div className="flex items-center justify-between rounded-lg bg-sand-50 px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-xs text-ink-600 border border-line/40">
            <span className="truncate">Peter joined the trip as Editor</span>
            <span className="shrink-0 text-[9px] sm:text-[10px] text-ink-600/70">Just now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
