import { useEffect, useState, type ComponentType } from "react";

import { NavLink, useLocation } from "react-router";
import { twMerge } from "tailwind-merge";

/**
 * Shared mobile bottom navigation. Edit BOTTOM_NAV_ITEMS to add/remove/reorder tabs.
 * Keep Account off by default here; account lives in the top header on mobile.
 */
interface BottomNavItem {
  label: string;
  to: string;
  Icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** When true, item is rendered (off by default to keep Account in header). */
  enabled?: boolean;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: "Home", to: "/", Icon: HomeIcon, end: true, enabled: true },
  { label: "Destinations", to: "/destinations", Icon: MapPinNavIcon, enabled: true },
  { label: "Map", to: "/map", Icon: MapFoldIcon, enabled: true },
  { label: "Trips", to: "/app/trips", Icon: SuitcaseIcon, enabled: true },
  // { label: "Account", to: "/app/profile", Icon: UserIcon, enabled: false },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function hasOpenOverlay(): boolean {
  if (typeof document === "undefined") return false;
  if (document.body.style.overflow === "hidden") return true;
  return Boolean(
    document.querySelector(
      '[aria-modal="true"], [data-bottom-nav-hide="true"], [role="dialog"][data-state="open"]',
    ),
  );
}

function shouldHideForPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/register" || pathname === "/auth/google/callback") return true;
  if (pathname.startsWith("/s/")) return true; // public shared recap
  if (pathname.startsWith("/admin")) return true; // admin has its own nav/footer patterns
  return false;
}

export function MobileBottomNav() {
  const location = useLocation();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    const syncKeyboard = () => setKeyboardOpen(isEditableTarget(document.activeElement));
    const onFocusIn = (event: FocusEvent) => setKeyboardOpen(isEditableTarget(event.target));
    const onFocusOut = () => window.setTimeout(syncKeyboard, 0);
    syncKeyboard();
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", syncKeyboard);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", syncKeyboard);
    };
  }, []);

  useEffect(() => {
    const sync = () => setOverlayOpen(hasOpenOverlay());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "aria-modal", "open", "data-state", "data-bottom-nav-hide"],
    });
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
    };
  }, []);

  const hidden = shouldHideForPath(location.pathname) || keyboardOpen || overlayOpen;
  const items = BOTTOM_NAV_ITEMS.filter((item) => item.enabled !== false);

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Main"
      className={twMerge("md:hidden", hidden && "hidden")}
      aria-hidden={hidden ? true : undefined}
    >
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav)] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between rounded-2xl border border-line/80 bg-white/95 px-2 py-1.5 shadow-[0_10px_40px_-10px_rgba(3,33,31,0.18)] backdrop-blur-md">
          {items.map(({ label, to, Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end ?? false}
              className={({ isActive }: { isActive: boolean }) =>
                twMerge(
                  "relative flex min-h-11 min-w-[4rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors",
                  isActive ? "text-surf-500" : "text-ink-600 hover:text-ink-900",
                )
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon className={twMerge("h-5 w-5", isActive ? "text-surf-500" : "text-ink-500")} />
                  <span>{label}</span>
                  {isActive ? (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-surf-500" aria-hidden="true" />
                  ) : (
                    <span className="mt-0.5 h-1 w-1" aria-hidden="true" />
                  )}
                </>
              )}
            </NavLink>
          ))}
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

function MapPinNavIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.1 7-11a7 7 0 10-14 0c0 5.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function MapFoldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
      <path d="M9 3v16" />
      <path d="M15 5v16" />
    </svg>
  );
}

function SuitcaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}
