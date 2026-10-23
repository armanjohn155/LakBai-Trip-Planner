<?php

namespace App\Notifications;

use App\Models\User;
use App\Support\NotificationType;

class ReviewReportedNotification extends AppNotification
{
    public function __construct(
        public int $reviewId,
        public string $reviewTitle,
        public User $actor,
        public ?string $reason = null,
    ) {}

    public function type(): string
    {
        return NotificationType::REVIEW_REPORTED;
    }

    public function message(): string
    {
        return $this->actor->name.' reported the review "'.$this->reviewTitle.'".';
    }

    public function actionUrl(): ?string
    {
        return '/admin/reviews?status=reported';
    }

    public function extraData(): array
    {
        return [
            'review_id' => $this->reviewId,
            'review_title' => $this->reviewTitle,
            'reason' => $this->reason,
            'actor' => $this->actorPayload($this->actor),
            'actionable' => false,
        ];
    }
}
