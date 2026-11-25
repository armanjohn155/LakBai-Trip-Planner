<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\User;
use App\Models\Visit;

/**
 * Links a verified visit to the destination it actually happened at.
 *
 * A custom trip stop has no destination of its own, so its verified visit is
 * stored with a null destination first. This service only links when one
 * destination is clearly nearest; equal-distance matches stay unlinked so a
 * traveller's history and review eligibility are never guessed.
 */
class VisitDestinationLinker
{
    /**
     * Two destinations closer than this to the traveller are treated as an
     * ambiguous match rather than silently picking one.
     */
    private const TIE_TOLERANCE_M = 1.0;

    public function __construct(private readonly CheckInVerifier $verifier) {}

    /**
     * The single active destination whose own radius contains this position.
     */
    public function match(float $latitude, float $longitude): ?Destination
    {
        $candidates = [];

        foreach (Destination::query()->whereNotNull('latitude')->whereNotNull('longitude')->get() as $destination) {
            $distance = $this->verifier->haversineMeters(
                (float) $destination->latitude,
                (float) $destination->longitude,
                $latitude,
                $longitude,
            );

            if ($distance <= $this->verifier->radiusFor($destination)) {
                $candidates[] = [
                    'destination' => $destination,
                    'distance' => $distance,
                ];
            }
        }

        if ($candidates === []) {
            return null;
        }

        usort($candidates, fn (array $left, array $right) => $left['distance'] <=> $right['distance']);

        if (count($candidates) > 1
            && ($candidates[1]['distance'] - $candidates[0]['distance']) <= self::TIE_TOLERANCE_M) {
            return null;
        }

        return $candidates[0]['destination'];
    }

    /**
     * Link an unlinked verified visit to a destination and retire any earlier
     * manual visit at the same place. Returns the matched destination, if any.
     */
    public function link(Visit $visit): ?Destination
    {
        if (! $visit->verified || $visit->destination_id !== null
            || $visit->latitude === null || $visit->longitude === null) {
            return null;
        }

        $destination = $this->match((float) $visit->latitude, (float) $visit->longitude);

        if ($destination === null) {
            return null;
        }

        // Linking would create a second verified visit at the same place inside
        // the cooldown window, so leave the custom-stop visit unlinked instead.
        if ($this->verifier->cooldownVisit($visit->user, $destination, $visit->visited_at) !== null) {
            return null;
        }

        $visit->forceFill(['destination_id' => $destination->id])->save();

        $this->supersedeManualVisits($visit->user, $destination, $visit);

        return $destination;
    }

    /**
     * Mark earlier manual visits as replaced by a verified visit so history
     * shows one entry and manual marks never unlock reviews.
     */
    public function supersedeManualVisits(User $user, Destination $destination, Visit $verifiedVisit): int
    {
        return Visit::query()
            ->where('user_id', $user->id)
            ->where('destination_id', $destination->id)
            ->where('verified', false)
            ->whereNull('superseded_at')
            ->whereKeyNot($verifiedVisit->id)
            ->update([
                'superseded_at' => now(),
                'superseded_by_visit_id' => $verifiedVisit->id,
            ]);
    }
}
