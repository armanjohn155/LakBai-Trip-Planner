import { useRef, useState, type FormEvent } from "react";

import { CameraIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiError, uploadAvatar, updateUser } from "@/lib/api";
import { Avatar } from "@/components/features/profile/profile-sidebar";

const memberSinceFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export function ProfileSummaryTab() {
  const { user, updateUser: storeUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const memberSince = user.created_at ? memberSinceFormatter.format(new Date(user.created_at)) : "—";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const updated = await updateUser({ name, email });
      storeUser(updated);
      setSuccess("Profile updated.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const onAvatarChange = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setSuccess(null);
    setAvatarBusy(true);
    try {
      const updated = await uploadAvatar(file);
      storeUser(updated);
      setSuccess("Profile photo updated.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">Profile</h1>
        <p className="mt-1 text-sm text-ink-600">Your details, as other Lakbai travellers see them.</p>
      </div>

      {error ? <InlineError message={error} /> : null}
      {success ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">{success}</div>
      ) : null}

      <Card className="glass-frost space-y-6 p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar name={user.name} src={user.avatar_url ?? null} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              aria-label="Upload profile photo"
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-surf-400 text-sand-50 ring-2 ring-white transition-colors hover:bg-surf-300 disabled:opacity-50"
            >
              {avatarBusy ? <Spinner className="h-4 w-4" /> : <CameraIcon className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void onAvatarChange(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-lagoon-900">{user.name}</p>
            <p className="text-sm text-ink-600">Member since {memberSince}</p>
            <p className="mt-0.5 text-xs text-ink-600">JPG or PNG, up to 2 MB.</p>
          </div>
        </div>
      </Card>

      <Card className="glass-frost p-6">
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-lagoon-900">Account details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="pt-1">
            <Button type="submit" disabled={busy} className="min-w-36">
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}