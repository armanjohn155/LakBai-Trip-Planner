import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";

import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { twMerge } from "tailwind-merge";

import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { Avatar } from "@/components/features/profile/profile-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { getFriendRequests } from "@/lib/api";
import { cn } from "@/lib/cn";

interface CenterLink {
  label: string;
  to: string;
  exact?: boolean;
}

const svgIconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M12 21s7-5.1 7-11a7 7 0 10-14 0c0 5.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const loggedIn = Boolean(user);

  const centerLinks: CenterLink[] = [
    { to: "/", label: "Home", exact: true },
    { to: "/destinations", label: "Destinations" },
    { to: "/map", label: "Map" },
    { to: loggedIn ? "/app/trips" : "/login", label: "Trips" },
  ];

  const planTrip = () => {
    if (loggedIn) {
      navigate("/app/trips/new");
    } else {
      navigate("/register");
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "relative rounded-full px-4 py-2 text-sm font-semibold transition-colors",
      isActive ? "text-lagoon-900" : "text-ink-700",
    );

  const renderCenterLink = (link: CenterLink) => (
    <NavLink key={link.label} to={link.to} end={link.exact} className={navItemClass}>
      {({ isActive }) => (
        <>
          {link.label}
          {isActive ? (
            <span
              className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-surf-400"
              aria-hidden="true"
            />
          ) : null}
        </>
      )}
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-[var(--z-header)] border-b border-line bg-white/95 pt-[env(safe-area-inset-top)] text-ink-900 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <img src="/Logo-main.png" alt="Lakbai" className="h-8 w-auto max-w-[7.5rem] object-contain sm:h-10 sm:max-w-none md:h-12" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Main navigation">
          {centerLinks.map((link) => renderCenterLink(link))}
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          {user ? <NotificationBell /> : null}
          <AccountMenu onSignOut={handleSignOut} />

          <button
            type="button"
            onClick={planTrip}
            aria-label="Plan trip"
            className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-surf-400 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-surf-300 whitespace-nowrap sm:px-4"
          >
            <PinIcon className="h-4 w-4" />
            <span className="hidden md:inline">Plan Trip</span>
          </button>
        </div>
      </div>
    </header>
  );
}

type AccountMenuMode = "dropdown" | "sheet";

interface AccountMenuProps {
  onSignOut: () => void;
}

interface AccountMenuItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  badge?: number;
  adminOnly?: boolean;
}

interface AccountMenuConfig {
  items: AccountMenuItem[];
  guest: boolean;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return isDesktop;
}

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Shared account menu (desktop dropdown + mobile bottom sheet).
 * Menu content comes from one config (`AccountMenuContent` + items) so both views stay in sync.
 */
function AccountMenu({ onSignOut }: AccountMenuProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [renderSheet, setRenderSheet] = useState(false);
  const [sheetEntered, setSheetEntered] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null);
  const prevPathRef = useRef(location.pathname + location.search + location.hash);
  const prevDesktopRef = useRef<boolean | null>(null);

  const isDesktop = useIsDesktop();
  const mode: AccountMenuMode = isDesktop ? "dropdown" : "sheet";
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getFriendRequests("incoming")
      .then((requests) => {
        if (!cancelled) setFriendRequestCount(requests.length);
      })
      .catch(() => {
        if (!cancelled) setFriendRequestCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, open, user]);

  const menuConfig: AccountMenuConfig = useMemo(() => {
    if (!user) return { items: [], guest: true };
    const items: AccountMenuItem[] = [
      { to: "/app/friends", label: "Friends", Icon: FriendsIcon, badge: friendRequestCount },
      { to: "/app/notifications", label: "Notifications", Icon: BellIcon },
      { to: "/app/history", label: "History", Icon: ClockIcon },
      { to: "/app/trips", label: "My Trips", Icon: PinIcon },
      { to: "/app/profile", label: "Profile", Icon: UserIcon },
      ...(user.role === "admin" ? [{ to: "/admin", label: "Admin", Icon: ShieldIcon, adminOnly: true }] : []),
    ];
    return { items, guest: false };
  }, [user, friendRequestCount]);

  const close = useCallback(() => setOpen(false), []);

  // Close on route change after choosing an item / navigation.
  useEffect(() => {
    const next = location.pathname + location.search + location.hash;
    if (prevPathRef.current !== next) {
      prevPathRef.current = next;
      if (open) setOpen(false);
    } else {
      prevPathRef.current = next;
    }
  }, [location.pathname, location.search, location.hash, open]);

  // Close when resizing across the breakpoint.
  useEffect(() => {
    if (prevDesktopRef.current === null) {
      prevDesktopRef.current = isDesktop;
      return;
    }
    if (prevDesktopRef.current !== isDesktop) {
      prevDesktopRef.current = isDesktop;
      if (open) setOpen(false);
    }
  }, [isDesktop, open]);

  // Mount/unmount animation for mobile sheet.
  useEffect(() => {
    if (mode === "sheet" && open) {
      setRenderSheet(true);
      setDragOffset(0);
      const id = window.requestAnimationFrame(() => setSheetEntered(true));
      return () => window.cancelAnimationFrame(id);
    }
    if (mode === "sheet" && !open && renderSheet) {
      setSheetEntered(false);
      if (reducedMotion) {
        setRenderSheet(false);
        return;
      }
      const timer = window.setTimeout(() => setRenderSheet(false), 200);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [mode, open, renderSheet, reducedMotion]);

  // Focus, scroll lock, escape/focus-trap for open menu (sheet gets full dialog behavior).
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    const focusInitial = () => {
      const container = mode === "sheet" ? sheetRef.current : dropdownRef.current;
      const focusable = getFocusable(container);
      (focusable[0] ?? container)?.focus?.();
    };

    const timer = window.setTimeout(focusInitial, 0);
    if (mode === "sheet") {
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (mode !== "sheet" || event.key !== "Tab") return;
      const container = sheetRef.current;
      const focusable = getFocusable(container);
      if (focusable.length === 0 || !container) {
        event.preventDefault();
        container?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (active && !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode, close]);

  // Return focus to the account button on close.
  useEffect(() => {
    if (open) return;
    const prev = previousFocusRef.current;
    if (prev) {
      previousFocusRef.current = null;
      window.requestAnimationFrame(() => {
        if (buttonRef.current) buttonRef.current.focus();
        else prev.focus?.();
      });
    }
  }, [open]);

  // Desktop dropdown: outside click closes.
  useEffect(() => {
    if (!open || mode !== "dropdown") return;
    const onPointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, mode, close]);

  const handleSignOut = async () => {
    close();
    await onSignOut();
  };

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "sheet") return;
    dragRef.current = { startY: event.clientY, pointerId: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    setDragOffset(delta > 0 ? delta : 0);
  };

  const onSheetPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (dragOffset > 80) {
      close();
    }
    setDragOffset(0);
  };

  const accountButton = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Account"
      className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100 hover:text-ink-900 md:px-3"
    >
      {user ? (
        <Avatar name={user.name} src={user.avatar_url ?? null} className="h-7 w-7 text-xs ring-1 ring-line md:h-5 md:w-5 md:text-[10px]" />
      ) : (
        <UserIcon className="h-4 w-4" />
      )}
      <span className="hidden md:inline">Account</span>
      <ChevronIcon className={cn("hidden h-3.5 w-3.5 transition-transform md:inline", open && "rotate-180")} />
    </button>
  );

  const sharedContent = (
    <AccountMenuContent
      mode={mode}
      user={user ? { name: user.name, email: user.email, avatar_url: user.avatar_url ?? null } : null}
      config={menuConfig}
      onClose={close}
      onSignOut={() => void handleSignOut()}
    />
  );

  return (
    <div className="relative">
      {accountButton}

      {/* Desktop dropdown (>= md) */}
      {open && mode === "dropdown" ? (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Account menu"
          className={twMerge(
            "glass-frost absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-64 rounded-2xl p-1.5 text-ink-900 shadow-lg",
          )}
        >
          {sharedContent}
        </div>
      ) : null}

      {/* Mobile bottom sheet (< md) */}
      {mode === "sheet" && renderSheet ? (
        <>
          <div
            className={twMerge(
              "fixed inset-0 z-[var(--z-dropdown)] bg-lagoon-950/45 transition-opacity",
              reducedMotion ? "duration-0" : "duration-200",
              sheetEntered && open ? "opacity-100" : "opacity-0",
            )}
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Account menu"
            tabIndex={-1}
            className={twMerge(
              "fixed inset-x-0 bottom-0 z-[calc(var(--z-dropdown)+1)] flex max-h-[100dvh] flex-col rounded-t-3xl border-t border-line bg-white text-ink-900 shadow-2xl outline-none",
              "pb-[env(safe-area-inset-bottom)]",
              reducedMotion ? "transition-none" : "transition-transform duration-200 ease-out",
              sheetEntered && open ? "translate-y-0" : "translate-y-full",
            )}
            style={dragOffset > 0 && sheetEntered && open ? { transform: `translateY(${dragOffset}px)` } : undefined}
          >
            <div
              className="flex shrink-0 touch-none justify-center pt-2 pb-1"
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerUp}
              onPointerCancel={onSheetPointerUp}
              aria-hidden="true"
            >
              <div className="h-1.5 w-12 rounded-full bg-sand-300" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
              {sharedContent}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AccountMenuContent({
  mode,
  user,
  config,
  onClose,
  onSignOut,
}: {
  mode: AccountMenuMode;
  user: { name: string; email: string; avatar_url: string | null } | null;
  config: AccountMenuConfig;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const isSheet = mode === "sheet";

  if (!user) {
    return (
      <div className={twMerge(isSheet ? "space-y-1 py-1" : "space-y-1 p-1")}>
        <p className={twMerge("font-semibold text-lagoon-900", isSheet ? "px-3 py-2 text-base" : "px-3 py-2 text-sm")}>Account</p>
        <Link
          to="/login"
          onClick={onClose}
          className={twMerge(
            "flex w-full items-center justify-between rounded-xl px-3 text-sm font-medium text-ink-900 transition-colors hover:bg-sand-100",
            isSheet ? "min-h-12 py-3" : "py-2",
          )}
        >
          <span>Sign in</span>
          {isSheet ? <ChevronRightIcon className="h-4 w-4 text-ink-400" /> : null}
        </Link>
        <Link
          to="/register"
          onClick={onClose}
          className={twMerge(
            "flex w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-sea-700 transition-colors hover:bg-surf-400/15",
            isSheet ? "min-h-12 bg-surf-400/10 py-3" : "bg-surf-400/10 py-2",
          )}
        >
          <span>Create account</span>
          {isSheet ? <ChevronRightIcon className="h-4 w-4 text-sea-600" /> : null}
        </Link>
      </div>
    );
  }

  return (
    <div className={twMerge(isSheet ? "py-1" : "")}>
      <div className={twMerge("flex items-center gap-3", isSheet ? "px-2 py-3" : "px-3 py-2.5")}>
        <Avatar
          name={user.name}
          src={user.avatar_url}
          className={twMerge(isSheet ? "h-12 w-12 text-base" : "h-9 w-9 text-sm", "ring-2 ring-white/30")}
        />
        <div className="min-w-0">
          <p className={twMerge("truncate font-semibold text-lagoon-900", isSheet ? "text-base" : "text-sm")}>{user.name}</p>
          <p className={twMerge("truncate text-ink-600", isSheet ? "text-sm" : "text-xs")}>{user.email}</p>
        </div>
      </div>

      <div className="my-1 h-px bg-line" />

      <div className={twMerge(isSheet ? "space-y-0.5" : "")}>
        {config.items.map(({ to, label, Icon, badge }) => (
          <Link
            key={to}
            to={to}
            role={isSheet ? undefined : "menuitem"}
            onClick={onClose}
            className={twMerge(
              "flex w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-900 transition-colors hover:bg-sand-100",
              isSheet ? "min-h-12 py-3" : "gap-2.5 py-2",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-ink-600" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {badge ? (
              <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-mango-400/30 px-1.5 py-0.5 text-[11px] font-bold text-lagoon-900">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
            {isSheet ? <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" /> : null}
          </Link>
        ))}
      </div>

      <div className="my-1 h-px bg-line" />

      <button
        type="button"
        role={isSheet ? undefined : "menuitem"}
        onClick={onSignOut}
        className={twMerge(
          "flex w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-sinulog-red transition-colors hover:bg-sinulog-red/5",
          isSheet ? "min-h-12 py-3" : "gap-2.5 py-2",
        )}
      >
        <LogOutIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 text-left">Sign out</span>
        {isSheet ? <ChevronRightIcon className="h-4 w-4 shrink-0 text-sinulog-red/60" /> : null}
      </button>
    </div>
  );
}

function FriendsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.5-3 2.6-4.7 5.5-4.7s5 1.7 5.5 4.7" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.4c2.4.1 4.1 1.6 4.5 4.1" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.6 3.1-5.5 7-5.5s6.4 1.9 7 5.5" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

