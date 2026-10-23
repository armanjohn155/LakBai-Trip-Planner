import { useMemo, useState } from "react";

import { Avatar } from "@/components/features/profile/profile-sidebar";
import { CheckIcon, FriendsIcon, SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { FriendUser } from "@/lib/types";

interface FriendPickerProps {
  friends: FriendUser[];
  selected: FriendUser[];
  onChange: (next: FriendUser[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  idPrefix?: string;
}

export function FriendPicker({
  friends,
  selected,
  onChange,
  loading = false,
  emptyMessage = "Add a friend first, then invite them to a trip.",
  idPrefix = "friend",
}: FriendPickerProps) {
  const [query, setQuery] = useState("");
  const selectedIds = useMemo(() => new Set(selected.map((friend) => friend.id)), [selected]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term === "") return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(term) ||
        (friend.username ?? "").toLowerCase().includes(term),
    );
  }, [friends, query]);

  const toggle = (friend: FriendUser) => {
    if (selectedIds.has(friend.id)) {
      onChange(selected.filter((item) => item.id !== friend.id));
    } else {
      onChange([...selected, friend]);
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-600">Loading friends...</p>;
  }

  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
        <FriendsIcon className="mx-auto h-6 w-6 text-sea-600" />
        <p className="mt-2 text-sm text-ink-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
          <SearchIcon className="h-4 w-4" />
        </span>
        <Input
          aria-label="Search friends"
          placeholder="Search friends by name or username"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-600">No friends match that search.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {filtered.map((friend) => {
            const checked = selectedIds.has(friend.id);
            return (
              <li key={friend.id}>
                <label
                  htmlFor={`${idPrefix}-${friend.id}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                    checked ? "bg-surf-400/10" : "hover:bg-sand-100/70",
                  )}
                >
                  <input
                    id={`${idPrefix}-${friend.id}`}
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggle(friend)}
                  />
                  <Avatar name={friend.name} src={friend.avatar_url ?? null} className="h-9 w-9 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{friend.name}</span>
                    <span className="block truncate text-xs text-ink-600">
                      {friend.username ? `@${friend.username}` : "LakBai traveller"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked ? "border-surf-400 bg-surf-400 text-white" : "border-line text-transparent",
                    )}
                    aria-hidden="true"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sand-100/70 p-2.5">
          {selected.map((friend) => (
            <Button
              key={friend.id}
              size="sm"
              variant="secondary"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => toggle(friend)}
              aria-label={`Remove ${friend.name}`}
            >
              {friend.name}
              <span aria-hidden="true">x</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
