<?php

namespace App\Services;

use App\Models\Itinerary;
use App\Models\ItineraryActivity;
use App\Models\User;
use Illuminate\Support\Carbon;

class ItineraryActivityLogger
{
    public function log(
        Itinerary $itinerary,
        string $action,
        ?User $user = null,
        ?string $subjectType = null,
        ?int $subjectId = null,
        array $meta = [],
    ): ItineraryActivity {
        return ItineraryActivity::create([
            'itinerary_id' => $itinerary->id,
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'meta' => empty($meta) ? null : $meta,
            'created_at' => Carbon::now(),
        ]);
    }
}
