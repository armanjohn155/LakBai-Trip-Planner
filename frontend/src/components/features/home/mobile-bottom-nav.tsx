import { NavLink } from "react-router";

interface MobileBottomNavTab {
  label: string;
  to: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const TABS: MobileBottomNavTab[] = [
  { label: "Home", to: "/", Icon: HomeIcon, end: true },
  { label: "Destination", to: "/destinations", Icon: BookIcon },
  { label: "Trips", to: "/app/trips", Icon: HeartIcon },
  { label: "Account", to: "/app/profile", Icon: UserIcon },
];

export function MobileBottomNav() {
  return (
    <nav aria-label="Bottom navigation" className="md:hidden">
      {/* Floating pill: 16px side margin, bottom safe-area offset */}
      <div className="fixed left-4 right-4 bottom-4 z-[1100] md:hidden">
        <div className="mx-auto w-full max-w-md">
          <div
            className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white shadow-[0_10px_40px_-10px_rgba(3,33,31,0.15)] border border-line"
          >
            {TABS.map(({ label, to, Icon, end }) => (
              <NavLink
                key={label}
                to={to}
                end={end ?? false}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors min-w-[60px] ${
                    isActive
                      ? "text-lagoon-900 bg-lagoon-50/60"
                      : "text-ink-500"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 21.5z" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.6 3.1-5.5 7-5.5s6.4 1.9 7 5.5" />
    </svg>
  );
}
