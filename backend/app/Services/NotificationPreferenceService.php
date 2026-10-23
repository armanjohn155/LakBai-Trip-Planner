<?php

namespace App\Services;

use App\Models\NotificationPreference;
use App\Models\User;
use App\Support\NotificationType;
use Illuminate\Support\Collection;

/**
 * Resolves notification channel preferences, falling back to the defaults
 * defined in NotificationType until a user overrides them.
 */
class NotificationPreferenceService
{
    /**
     * @var array<string, bool>
     */
    private array $cache = [];

    public function enabled(User $user, string $type, string $channel): bool
    {
        if (! NotificationType::exists($type) || ! in_array($channel, NotificationType::channels(), true)) {
            return false;
        }

        $key = $user->id.':'.$type.':'.$channel;

        if (array_key_exists($key, $this->cache)) {
            return $this->cache[$key];
        }

        $stored = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('type', $type)
            ->where('channel', $channel)
            ->value('enabled');

        $enabled = $stored === null
            ? (bool) NotificationType::defaults($type)[$channel]
            : (bool) $stored;

        return $this->cache[$key] = $enabled;
    }

    /**
     * The full preference matrix for the settings screen.
     *
     * @return array<int, array{type: string, label: string, channels: array<string, bool>}>
     */
    public function matrix(User $user): array
    {
        return collect(NotificationType::all())
            ->reject(fn (string $type) => $type === NotificationType::REVIEW_REPORTED && ! $user->isAdmin())
            ->map(fn (string $type) => [
                'type' => $type,
                'label' => NotificationType::label($type),
                'channels' => collect(NotificationType::channels())
                    ->mapWithKeys(fn (string $channel) => [$channel => $this->enabled($user, $type, $channel)])
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{type: string, channel: string, enabled: bool}>  $changes
     */
    public function update(User $user, array $changes): void
    {
        foreach ($changes as $change) {
            NotificationPreference::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'type' => $change['type'],
                    'channel' => $change['channel'],
                ],
                ['enabled' => (bool) $change['enabled']],
            );
        }

        $this->cache = [];
    }

    /**
     * Email is only attempted for real transports; log/array mailers are
     * treated as "not configured" so local development stays quiet.
     */
    public function mailConfigured(): bool
    {
        $mailer = config('mail.default');

        return is_string($mailer)
            && $mailer !== ''
            && ! in_array($mailer, ['array', 'log'], true);
    }

    /**
     * @return Collection<int, string>
     */
    public function emailTypes(User $user): Collection
    {
        return collect(NotificationType::all())
            ->filter(fn (string $type) => $this->enabled($user, $type, 'email'))
            ->values();
    }
}
