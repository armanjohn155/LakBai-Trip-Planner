import { useEffect, useRef, useState, type ComponentType } from "react";

import { Link, NavLink, useNavigate } from "react-router";

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
  const [open, setOpen] = useState(false);

  const loggedIn = Boolean(user);

  const centerLinks: CenterLink[] = [
    { to: "/", label: "Home", exact: true },
    { to: "/destinations", label: "Destinations" },
    { to: "/map", label: "Map" },
    { to: loggedIn ? "/app/trips" : "/register", label: "Trips" },
  ];

  const closeMenu = () => setOpen(false);

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

  const renderCenterLink = (link: CenterLink, onNavigate?: () => void) => (
    <NavLink key={link.label} to={link.to} end={link.exact} onClick={onNavigate} className={navItemClass}>
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
    <header className="sticky top-0 z-[1100] border-b border-line bg-white text-ink-900">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" onClick={closeMenu}>
          <img src="/Logo-main.png" alt="Manglakaw Logo" className="h-20 w-35" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">{centerLinks.map((link) => renderCenterLink(link))}</nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <AccountDropdown onSignOut={handleSignOut} />
          ) : (
            <>
              <Link to="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:text-ink-900">
                Sign in
              </Link>
              <Link to="/register" className="hidden rounded-full bg-sand-100 px-4 py-2 text-sm font-semibold text-lagoon-900 transition-colors hover:bg-sand-200 sm:inline">
                Create account
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={planTrip}
            className="inline-flex items-center gap-1.5 rounded-full bg-surf-400 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-surf-300 sm:px-4"
          >
            <PinIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Plan Trip</span>
            <span className="sm:hidden">Plan</span>
          </button>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-sand-100 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {centerLinks.map((link) => renderCenterLink(link, closeMenu))}
            {!user ? (
              <Link to="/register" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
                Create account
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

interface AccountDropdownProps {
  onSignOut: () => void;
}

interface AccountItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  badge?: number;
}

function AccountDropdown({ onSignOut }: AccountDropdownProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, [user?.id, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  const items: AccountItem[] = [
    { to: "/app", label: "Dashboard", Icon: GridIcon },
    { to: "/app/trips", label: "My Trips", Icon: PinIcon },
    { to: "/app/history", label: "Visiting History", Icon: ClockIcon },
    { to: "/app/reviews", label: "My Reviews", Icon: StarIcon },
    { to: "/app/favorites", label: "Favorites", Icon: HeartIcon },
    { to: "/app/friends", label: "Friends", Icon: FriendsIcon, badge: friendRequestCount },
    { to: "/app/profile", label: "Profile", Icon: UserIcon },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin", Icon: ShieldIcon }] : []),
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100 hover:text-ink-900"
      >
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Account</span>
        <ChevronIcon className={cn("hidden h-3.5 w-3.5 transition-transform sm:inline", open && "rotate-180")} />
      </button>

      {open ? (
        <div role="menu" className="glass-frost absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl p-1.5 text-ink-900">
          {user ? (
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={user.name} src={user.avatar_url ?? null} className="h-9 w-9 text-sm ring-2 ring-white/30" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-lagoon-900">{user.name}</p>
                <p className="truncate text-xs text-ink-600">{user.email}</p>
              </div>
            </div>
          ) : null}

          <div className="my-1 h-px bg-line" />

          {items.map(({ to, label, Icon, badge }) => (
            <Link key={to} to={to} role="menuitem" onClick={close} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-900 transition-colors hover:bg-sand-100">
              <Icon className="h-4 w-4 text-ink-600" />
              {label}
              {badge ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-mango-400/30 px-1.5 py-0.5 text-[11px] font-bold text-lagoon-900">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </Link>
          ))}

          <div className="my-1 h-px bg-line" />

          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sinulog-red transition-colors hover:bg-sinulog-red/5"
          >
            <LogOutIcon className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
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

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}