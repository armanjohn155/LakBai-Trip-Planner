import { useState } from "react";

import { useNavigate } from "react-router";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { cn } from "@/lib/cn";
import type { User } from "@/lib/types";

interface MobileHomeTopSectionProps {
  user: User | null;
  onProfilePress: () => void;
  onNotificationsPress: () => void;
}

const CATEGORY_TABS = [
  { label: "Metro Cebu", count: 12 },
  { label: "North", count: 8 },
  { label: "South", count: 15 },
  { label: "Islands", count: 6 },
];

export function MobileHomeTopSection({
  user,
  onProfilePress,
  onNotificationsPress,
}: MobileHomeTopSectionProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Metro Cebu");
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate("/destinations", { state: { search: query } });
  };

  return (
    <section className="px-4 pb-6">
      {/* Row: user avatar + name + location | notification bell */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onProfilePress}
          aria-label="Profile"
          className="flex items-center gap-2"
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white ring-offset-1"
            />
          ) : (
            <Avatar name={user?.name ?? "Guest"} src={null} className="h-10 w-10 text-sm ring-2 ring-white ring-offset-1" />
          )}
          <div className="ml-2 min-w-0">
            <p className="text-sm font-semibold text-ink-900 leading-tight truncate">
              {user?.name ?? "Guest"}
            </p>
            <p className="text-xs text-ink-500 truncate">Cebu, PH</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onNotificationsPress}
          aria-label="Notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-md text-ink-600 hover:bg-sand-50 transition-colors"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            3
          </span>
        </button>
      </div>

      {/* Search field */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && handleSearch()}
          placeholder="Find your place"
          aria-label="Search destinations"
          className="h-11 w-full rounded-full border-0 bg-sand-100 pl-10 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-surf-400"
        />
        <button
          type="button"
          onClick={handleSearch}
          aria-label="Search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
        >
          <SearchIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Filters"
          className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:block text-ink-400 hover:text-ink-900"
        >
          <FilterIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Category tabs - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.label;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(tab.label)}
              aria-pressed={isActive}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-lagoon-900 bg-lagoon-900 text-white"
                  : "border-line bg-white text-ink-600 hover:border-surf-400 hover:text-lagoon-900",
              )}
            >
              {tab.label}
              <span className="ml-1 h-2 w-2 rounded-full bg-lagoon-900 opacity-0 transition-opacity {isActive ? 'opacity-100' : 'opacity-0'}"></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 19 14 12.46 22 3" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
