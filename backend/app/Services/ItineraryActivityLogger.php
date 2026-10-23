<?php

namespace App\Services;

<<<<<<< HEAD
use App\Events\TripUpdated;
use App\Models\Itinerary;
use App\Models\ItineraryActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ItineraryActivityLogger
{
    /**
     * Record an activity on an itinerary. The actor is the current user unless
     * one is provided. Meta is intentionally small and must never contain
     * emails, tokens or other sensitive data.
     *
     * @param  array<string, mixed>  $meta
     */
    public function log(
        Itinerary $itinerary,
        string $action,
        ?User $actor = null,
        ?Model $subject = null,
        array $meta = [],
    ): ItineraryActivity {
        return ItineraryActivity::query()->create([
            'itinerary_id' => $itinerary->id,
            'user_id' => $actor?->id ?? auth()->id(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'meta' => $meta === [] ? null : $meta,
            'created_at' => now(),
        ]);
    }

    /**
     * Bump the itinerary version and stamp who changed it, then log the
     * activity. Call inside the same transaction as the change so the version
     * and activity move together.
     *
     * @param  array<string, mixed>  $meta
     */
    public function recordChange(
        Itinerary $itinerary,
        string $action,
        ?User $actor = null,
        ?Model $subject = null,
        array $meta = [],
    ): Itinerary {
        $itinerary->forceFill([
            'version' => $itinerary->version + 1,
            'updated_by' => $actor?->id ?? auth()->id(),
        ])->save();

        $this->log($itinerary, $action, $actor, $subject, $meta);

        event(new TripUpdated($itinerary, $actor, $action, $meta));

        return $itinerary;
    }
=======
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
>>>>>>> origin/main
}
