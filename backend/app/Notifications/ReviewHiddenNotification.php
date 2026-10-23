<?php

namespace App\Notifications;

use App\Support\NotificationType;

class ReviewHiddenNotification extends AppNotification
{
    public function __construct(
        public int $reviewId,
        public string $reviewTitle,
        public ?string $reason = null,
    ) {}

    public function type(): string
    {
        return NotificationType::REVIEW_HIDDEN;
    }

    public function message(): string
    {
        return 'Your review "'.$this->reviewTitle.'" was hidden by a moderator.';
    }

    public function actionUrl(): ?string
    {
        return '/app/reviews';
    }

    public function extraData(): array
    {
        return [
            'review_id' => $this->reviewId,
            'review_title' => $this->reviewTitle,
            'reason' => $this->reason,
            'actionable' => false,
        ];
    }

    public function mailSubject(): string
    {
        return 'Your review was hidden';
    }
}
