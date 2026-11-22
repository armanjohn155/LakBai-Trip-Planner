import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { twMerge } from "tailwind-merge";

import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { Avatar } from "@/components/features/profile/profile-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
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
 * One account menu for every breakpoint.
 *
 * Desktop renders a dropdown anchored under the trigger. Mobile renders the
 * exact same content in a floating card pinned under the header, constrained
 * to the viewport with internal scrolling. There is only one account UI, and
 * only one place (`AccountMenuContent`) that defines its rows.
 */
function AccountMenu({ onSignOut }: AccountMenuProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const prevPathRef = useRef(location.pathname + location.search + location.hash);

  const isDesktop = useIsDesktop();

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
      { to: "/app/notifications", label: "Notifications", Icon: BellIcon, badge: unreadCount },
      { to: "/app/history", label: "History", Icon: ClockIcon },
      { to: "/app/trips", label: "My Trips", Icon: PinIcon },
      { to: "/app/profile", label: "Profile", Icon: UserIcon },
      ...(user.role === "admin" ? [{ to: "/admin", label: "Admin", Icon: ShieldIcon, adminOnly: true }] : []),
    ];
    return { items, guest: false };
  }, [user, friendRequestCount, unreadCount]);

  const close = useCallback(() => setOpen(false), []);

  // Close on route change after choosing an item / navigation.
  useEffect(() => {
    const next = location.pathname + location.search + location.hash;
    if (prevPathRef.current === next) return;
    prevPathRef.current = next;
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setOpen(false);
    });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, location.hash, open]);

  // Close when the layout crosses the desktop breakpoint.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => setOpen(false);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  // Focus into the menu, lock page scroll on mobile, close on Escape, trap Tab on mobile.
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    const focusInitial = () => {
      const focusable = getFocusable(menuRef.current);
      (focusable[0] ?? menuRef.current)?.focus?.();
    };

    const timer = window.setTimeout(focusInitial, 0);
    if (!isDesktop) {
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (isDesktop || event.key !== "Tab") return;
      const container = menuRef.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
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
  }, [open, isDesktop, close]);

  // Return focus to the account button on close.
  useEffect(() => {
    if (open) return;
    const prev = previousFocusRef.current;
    if (!prev) return;
    previousFocusRef.current = null;
    if (buttonRef.current) buttonRef.current.focus();
    else prev.focus?.();
  }, [open]);

  // Outside pointer/tap closes the menu on both layouts.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const handleSignOut = async () => {
    close();
    await onSignOut();
  };

  const accountButton = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Account"
      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100 hover:text-ink-900 md:px-3"
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
      compact={isDesktop}
      user={user ? { name: user.name, email: user.email, avatar_url: user.avatar_url ?? null } : null}
      config={menuConfig}
      onClose={close}
      onSignOut={() => void handleSignOut()}
    />
  );

  const mobileMenu =
    open && !isDesktop && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Account menu"
            tabIndex={-1}
            className={twMerge(
              "glass-frost fixed right-4 z-[var(--z-dropdown)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl p-1.5 text-ink-900 shadow-lg outline-none",
              "top-[calc(env(safe-area-inset-top)+var(--header-h)+0.25rem)]",
              "max-h-[calc(100dvh-var(--header-h)-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]",
              "pb-[max(0.375rem,env(safe-area-inset-bottom))]",
            )}
          >
            {sharedContent}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      {accountButton}

      {/* Desktop dropdown (>= md) */}
      {open && isDesktop ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account menu"
          tabIndex={-1}
          className="glass-frost absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-64 rounded-2xl p-1.5 text-ink-900 shadow-lg outline-none"
        >
          {sharedContent}
        </div>
      ) : null}

      {mobileMenu}
    </div>
  );
}

function AccountMenuContent({
  compact,
  user,
  config,
  onClose,
  onSignOut,
}: {
  compact: boolean;
  user: { name: string; email: string; avatar_url: string | null } | null;
  config: AccountMenuConfig;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const rowClass = compact ? "py-2" : "min-h-11 py-2.5";

  if (!user) {
    return (
      <div className="space-y-1 p-1">
        <p className="px-3 py-2 text-sm font-semibold text-lagoon-900">Account</p>
        <Link
          to="/login"
          role="menuitem"
          onClick={onClose}
          className={twMerge(
            "flex w-full items-center rounded-xl px-3 text-sm font-medium text-ink-900 transition-colors hover:bg-sand-100",
            rowClass,
          )}
        >
          <span className="truncate">Sign in</span>
        </Link>
        <Link
          to="/register"
          role="menuitem"
          onClick={onClose}
          className={twMerge(
            "flex w-full items-center rounded-xl px-3 text-sm font-semibold text-sea-700 transition-colors hover:bg-surf-400/15",
            "bg-surf-400/10",
            rowClass,
          )}
        >
          <span className="truncate">Create account</span>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Avatar name={user.name} src={user.avatar_url} className="h-9 w-9 text-sm ring-2 ring-white/30" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-lagoon-900">{user.name}</p>
          <p className="truncate text-xs text-ink-600">{user.email}</p>
        </div>
      </div>

      <div className="my-1 h-px bg-line" />

      <div>
        {config.items.map(({ to, label, Icon, badge }) => (
          <Link
            key={to}
            to={to}
            role="menuitem"
            onClick={onClose}
            className={twMerge(
              "flex w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-900 transition-colors hover:bg-sand-100",
              rowClass,
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-ink-600" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {badge ? (
              <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-mango-400/30 px-1.5 py-0.5 text-[11px] font-bold text-lagoon-900">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="my-1 h-px bg-line" />

      <button
        type="button"
        role="menuitem"
        onClick={onSignOut}
        className={twMerge(
          "flex w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-sinulog-red transition-colors hover:bg-sinulog-red/5",
          rowClass,
        )}
      >
        <LogOutIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Sign out</span>
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

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
