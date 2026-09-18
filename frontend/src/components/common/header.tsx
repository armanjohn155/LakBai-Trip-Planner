import { useEffect, useRef, useState } from "react";

import { Link, NavLink, useNavigate } from "react-router";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/cn";

interface CenterLink {
  label: string;
  to: string;
  exact?: boolean;
  dot?: boolean;
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
    { to: loggedIn ? "/app/trips" : "/register", label: "Trips", dot: loggedIn },
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
      "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
      isActive ? "bg-surf-400 text-white" : "text-sand-50/75 hover:bg-white/10 hover:text-sand-50",
    );

  const renderCenterLink = (link: CenterLink, onNavigate?: () => void) => (
    <NavLink key={link.label} to={link.to} end={link.exact} onClick={onNavigate} className={navItemClass}>
      {({ isActive }) => (
        <span className="inline-flex items-center gap-1.5">
          {link.label}
          {link.dot && isActive ? <span className="h-1.5 w-1.5 rounded-full bg-surf-300" aria-hidden="true" /> : null}
        </span>
      )}
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-[1100] border-b border-white/10 bg-gradient-to-r from-royal-950 via-royal-900 to-royal-800 text-sand-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" onClick={closeMenu}>
          <PinIcon className="h-5 w-5 text-surf-300" />
          <span className="font-brand text-2xl leading-none text-sand-50">LAKBAI</span>
          <span className="hidden text-xs text-sand-50/80 lg:inline">Manglakaw ta, Bai!</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">{centerLinks.map((link) => renderCenterLink(link))}</nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <AccountDropdown onSignOut={handleSignOut} />
          ) : (
            <>
              <Link to="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-sand-50/80 transition-colors hover:text-sand-50">
                Sign in
              </Link>
              <Link to="/register" className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-sand-50 transition-colors hover:bg-white/15 sm:inline">
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {centerLinks.map((link) => renderCenterLink(link, closeMenu))}
            {!user ? (
              <Link to="/register" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm font-medium text-sand-50/80 hover:bg-white/10">
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

function AccountDropdown({ onSignOut }: AccountDropdownProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const items = [
    { to: "/app", label: "Dashboard", Icon: GridIcon },
    { to: "/app/trips", label: "My Trips", Icon: PinIcon },
    { to: "/app/favorites", label: "Favorites", Icon: HeartIcon },
    { to: "/app/profile", label: "Profile", Icon: UserIcon },
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-sand-50/80 transition-colors hover:bg-white/10 hover:text-sand-50"
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

          {items.map(({ to, label, Icon }) => (
            <Link key={to} to={to} role="menuitem" onClick={close} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-900 transition-colors hover:bg-sand-100">
              <Icon className="h-4 w-4 text-ink-600" />
              {label}
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgIconProps} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.6 3.1-5.5 7-5.5s6.4 1.9 7 5.5" />
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