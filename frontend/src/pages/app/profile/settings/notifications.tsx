import { useNotificationPreferences } from "@/hooks/use-notifications";
import { cn } from "@/lib/cn";

export default function NotificationPreferencesPage() {
  const { preferences, loading, saving, save } = useNotificationPreferences();

  const toggle = async (type: string, channel: string, enabled: boolean) => {
    try {
      await save([{ type, channel, enabled: !enabled }]);
    } catch {
      // The save state is surfaced by the toggle being re-enabled.
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-600">Loading preferences...</p>;
  }

  if (!preferences) {
    return <p className="text-sm text-ink-600">Unable to load preferences.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-lagoon-900">Notification preferences</h1>
        <p className="text-sm text-ink-600">Choose how you want to be notified.</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-12">
          <div className="sm:col-span-6 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Type</div>
          <div className="hidden sm:col-span-3 sm:block px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">In-app</div>
          <div className="hidden sm:col-span-3 sm:block px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Email</div>
        </div>
        <div className="divide-y divide-line">
          {preferences.preferences.map((pref) => (
            <div key={pref.type} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-6">
                <p className="text-sm font-medium text-ink-900">{pref.label}</p>
                <p className="text-xs text-ink-500">{pref.type}</p>
              </div>
              <div className="flex items-center justify-between sm:col-span-3 sm:justify-start">
                <span className="sm:hidden text-xs text-ink-500">In-app</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggle(pref.type, "in_app", pref.channels.in_app)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    pref.channels.in_app ? "bg-surf-400" : "bg-ink-200",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      pref.channels.in_app ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between sm:col-span-3 sm:justify-start">
                <span className="sm:hidden text-xs text-ink-500">Email</span>
                <button
                  type="button"
                  disabled={saving || !preferences.mail_configured}
                  onClick={() => toggle(pref.type, "email", pref.channels.email)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    pref.channels.email && preferences.mail_configured ? "bg-surf-400" : "bg-ink-200",
                    (!preferences.mail_configured) && "opacity-50",
                  )}
                  title={!preferences.mail_configured ? "Email not configured" : undefined}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      pref.channels.email && preferences.mail_configured ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {!preferences.mail_configured ? (
        <p className="text-xs text-ink-500">Email notifications are only sent when a real mail transport is configured.</p>
      ) : null}
    </div>
  );
}
