import { useEffect, useState, type FormEvent } from "react";

import { useOutletContext } from "react-router";

import { ShieldIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { apiError, changePassword, deleteAccount, getSettings, updateSettings } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { UserSettings } from "@/lib/types";
import type { ProfileTabContext } from "@/pages/dashboard/user/profile";

const defaultSettings: UserSettings = { email_reminders: true, digest: true, marketing: false };

export function SettingsTab() {
  const { userSettings, onAccountDeleted } = useOutletContext<ProfileTabContext>();
  const [settings, setSettings] = useState<UserSettings>(userSettings ?? defaultSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    if (userSettings) {
      return;
    }
    let cancelled = false;
    getSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch((err) => {
        if (!cancelled) setSettingsError(apiError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [userSettings]);

  const saveSettings = async (next: UserSettings) => {
    setSettings(next);
    setSettingsSaved(false);
    setSettingsError(null);
    setSettingsBusy(true);
    try {
      const updated = await updateSettings(next);
      setSettings(updated);
      setSettingsSaved(true);
    } catch (err) {
      setSettingsError(apiError(err));
    } finally {
      setSettingsBusy(false);
    }
  };

  const changePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setPasswordBusy(true);
    try {
      await changePassword({ current_password: currentPassword, password: newPassword, password_confirmation: confirmPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(apiError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const confirmDelete = async (event: FormEvent) => {
    event.preventDefault();
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await deleteAccount(deletePassword);
      await onAccountDeleted();
    } catch (err) {
      setDeleteError(apiError(err));
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-lagoon-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-600">Password, preferences, and your account.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={(event) => void changePasswordSubmit(event)} className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-lagoon-900">Change password</h2>
          {passwordError ? <InlineError message={passwordError} /> : null}
          {passwordSaved ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">Password updated.</div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </div>
          <div className="pt-1">
            <Button type="submit" disabled={passwordBusy || !newPassword || newPassword !== confirmPassword}>
              {passwordBusy ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-5 p-6">
        <h2 className="font-display text-lg font-semibold text-lagoon-900">Preferences</h2>
        {settingsError ? <InlineError message={settingsError} /> : null}
        <div className="divide-y divide-line">
          <PreferenceToggle
            title="Trip reminders"
            detail="Reminders before upcoming stops."
            checked={settings.email_reminders}
            disabled={settingsBusy}
            onChange={(value) => void saveSettings({ ...settings, email_reminders: value })}
          />
          <PreferenceToggle
            title="Weekly digest"
            detail="A summary of new spots across Cebu."
            checked={settings.digest}
            disabled={settingsBusy}
            onChange={(value) => void saveSettings({ ...settings, digest: value })}
          />
          <PreferenceToggle
            title="Product updates"
            detail="Occasional notes on new Lakbai features."
            checked={settings.marketing}
            disabled={settingsBusy}
            onChange={(value) => void saveSettings({ ...settings, marketing: value })}
          />
        </div>
        <p className="text-sm text-ink-600">{settingsSaved ? "Preferences saved." : settingsBusy ? <Spinner className="mr-1 inline h-4 w-4" /> : null}</p>
      </Card>

      <Card className="border-red-200 p-6 ring-red-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-red-700">Danger zone</h2>
            <p className="mt-1 max-w-md text-sm text-ink-600">Permanently delete your account, trips, and favorites.</p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete account
          </Button>
        </div>
      </Card>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl glass p-5">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-sand-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <form onSubmit={(event) => void confirmDelete(event)} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-inset ring-red-200">
                  <ShieldIcon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-lagoon-900">Delete your account?</h2>
                  <p className="text-sm text-ink-600">This can't be undone.</p>
                </div>
              </div>
              {deleteError ? <InlineError message={deleteError} /> : null}
              <Input
                label="Enter your password to confirm"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" type="submit" disabled={deleteBusy || !deletePassword}>
                  {deleteBusy ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreferenceToggle({
  title,
  detail,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("flex w-full items-center justify-between gap-4 py-4 text-left", disabled && "cursor-not-allowed opacity-60")}
    >
      <span>
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="block text-sm text-ink-600">{detail}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-surf-400" : "bg-sand-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}