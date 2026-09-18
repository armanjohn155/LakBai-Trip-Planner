import { useState } from "react";
import { NavLink } from "react-router";

import { HeartIcon, LogOutIcon, PinIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { API_ORIGIN } from "@/lib/api";
import type { User } from "@/lib/types";

interface ProfileSidebarProps {
  user: User;
  stats: { trips: number; favorites: number };
  onSignOut: () => void;
}

const memberSinceFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export function ProfileSidebar({ user, stats, onSignOut }: ProfileSidebarProps) {
  const memberSince = user.created_at ? memberSinceFormatter.format(new Date(user.created_at)) : null;

  const navItems = [
    { to: "/app/profile", label: "Profile", Icon: UserIcon, end: true },
    { to: "/app/profile/trips", label: "My Trips", Icon: PinIcon },
    { to: "/app/profile/favorites", label: "Favorites", Icon: HeartIcon },
    { to: "/app/profile/settings", label: "Settings", Icon: ShieldIcon },
  ];

  return (
    <Card className="glass-frost flex h-auto flex-col p-6">
      <div className="flex flex-col items-center">
        <Avatar name={user.name} src={user.avatar_url ?? null} />
        <h2 className="mt-4 font-display text-xl font-semibold text-lagoon-900">{user.name}</h2>
        <p className="mt-1 text-sm text-ink-600">{memberSince ? `Member since ${memberSince}` : "Lakbai member"}</p>
      </div>

      <div className="my-5 h-px bg-line" />

      <div className="grid grid-cols-2 gap-2 text-center">
        <Stat value={stats.trips} label="Trips" />
        <Stat value={stats.favorites} label="Favorites" />
      </div>

      <div className="my-5 h-px bg-line" />

      <nav className="flex flex-col gap-1" aria-label="Profile">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-sand-200 text-lagoon-900" : "text-ink-600 hover:bg-sand-100",
              )
            }
          >
            <Icon className="h-4.5 w-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-transparent font-semibold text-sinulog-red ring-1 ring-inset ring-sinulog-red/20 transition-colors hover:bg-sinulog-red/5"
        >
          <LogOutIcon className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </Card>
  );
}

const avatarClasses = cn(
  "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-surf-400 to-sinulog-magenta font-display text-4xl font-semibold text-white ring-2 ring-white/30",
);

function resolveAvatarUrl(src: string): string {
  try {
    const parsed = new URL(src, window.location.origin);
    if (parsed.pathname.startsWith("/storage/")) {
      return new URL(parsed.pathname, API_ORIGIN).href;
    }
  } catch {
    return src;
  }
  return src;
}

export function Avatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = src ? resolveAvatarUrl(src) : null;

  if (!url || failedUrl === url) {
    return (
      <span aria-hidden="true" className={cn(avatarClasses, className)}>
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span className={cn(avatarClasses, className)}>
      <img
        src={url}
        alt={`${name} profile photo`}
        className="h-full w-full object-cover"
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-lagoon-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-ink-600">{label}</p>
    </div>
  );
}