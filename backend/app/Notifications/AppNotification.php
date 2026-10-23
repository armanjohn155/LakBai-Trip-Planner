<?php

namespace App\Notifications;

use App\Models\User;
use App\Services\NotificationPreferenceService;
use App\Support\NotificationType;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

/**
 * Base class for every Lakbai notification. Each concrete notification
 * declares a stable type, a human message, and a safe JSON payload.
 */
abstract class AppNotification extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

    abstract public function type(): string;

    abstract public function message(): string;

    public function actionUrl(): ?string
    {
        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public function extraData(): array
    {
        return [];
    }

    public function mailSubject(): string
    {
        return $this->message();
    }

    /**
     * Laravel stores this value in the notifications.type column, so filters
     * and preferences can use the stable identifier instead of a class name.
     */
    public function databaseType(object $notifiable): string
    {
        return $this->type();
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return [];
        }

        $preferences = app(NotificationPreferenceService::class);
        $channels = [];

        if ($preferences->enabled($notifiable, $this->type(), 'in_app')) {
            $channels[] = 'database';
        }

        if ($preferences->enabled($notifiable, $this->type(), 'email') && $preferences->mailConfigured()) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return array_merge([
            'type' => $this->type(),
            'message' => $this->message(),
            'action_url' => $this->actionUrl(),
        ], $this->extraData());
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = $this->actionUrl();
        $mail = (new MailMessage)
            ->subject($this->mailSubject())
            ->line($this->message());

        if ($url) {
            $mail->action('Open Lakbai', $this->absoluteUrl($url));
        }

        return $mail;
    }

    protected function absoluteUrl(string $path): string
    {
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        $base = rtrim((string) config('lakbai.sharing.frontend_url', config('app.url')), '/');

        return $base.'/'.ltrim($path, '/');
    }

    /**
     * @return array{id: int, name: string, avatar_url: string|null}
     */
    protected function actorPayload(?User $actor): array
    {
        return [
            'id' => (int) $actor?->id,
            'name' => (string) $actor?->name,
            'avatar_url' => $actor?->avatar_url,
        ];
    }

    protected function typeLabel(): string
    {
        return NotificationType::label($this->type());
    }

    /**
     * @return array<string, mixed>
     */
    protected function itineraryPayload(\App\Models\Itinerary $itinerary): array
    {
        return [
            'itinerary_id' => (int) $itinerary->id,
            'itinerary_title' => (string) $itinerary->title,
            'start_date' => $itinerary->start_date?->toDateString(),
            'end_date' => $itinerary->end_date?->toDateString(),
        ];
    }
}
