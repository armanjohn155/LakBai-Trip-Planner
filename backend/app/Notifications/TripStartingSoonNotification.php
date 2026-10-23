<?php

namespace App\Notifications;

use App\Models\Itinerary;
use App\Support\NotificationType;

class TripStartingSoonNotification extends AppNotification
{
    public function __construct(public Itinerary $itinerary) {}

    public function type(): string
    {
        return NotificationType::TRIP_STARTING_SOON;
    }

    public function message(): string
    {
        $when = $this->itinerary->start_date?->toDateString() ?? 'soon';

        return '"'.$this->itinerary->title.'" starts on '.$when.'.';
    }

    public function actionUrl(): ?string
    {
        return '/app/trips/'.$this->itinerary->id;
    }

    public function extraData(): array
    {
        return array_merge($this->itineraryPayload($this->itinerary), [
            'actionable' => false,
        ]);
    }
}
