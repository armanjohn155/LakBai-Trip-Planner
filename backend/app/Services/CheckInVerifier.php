<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Carbon;

/**
 * Server-side verification of GPS check-ins.
 *
 * The client is never trusted: distance, accuracy, cooldown and
 * impossible-travel checks all run here.
 */
class CheckInVerifier
{
    private const EARTH_RADIUS_M = 6371000.0;

    public function __construct(
        private readonly int $maxAccuracyM = 100,
        private readonly int $cooldownHours = 12,
        private readonly int $defaultRadiusM = 150,
        private readonly float $maxSpeedKmh = 900.0,
    ) {}

    /**
     * Build a verifier from config/lakbai.php.
     */
    public static function fromConfig(): self
    {
        return new self(
            maxAccuracyM: (int) config('lakbai.max_accuracy_m', 100),
            cooldownHours: (int) config('lakbai.cooldown_hours', 12),
            defaultRadiusM: (int) config('lakbai.default_radius_m', 150),
            maxSpeedKmh: (float) config('lakbai.max_speed_kmh', 900),
        );
    }

    /**
     * Great-circle distance between two coordinates in meters (Haversine).
     */
    public function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $lat1Rad = deg2rad($lat1);
        $lat2Rad = deg2rad($lat2);
        $deltaLat = deg2rad($lat2 - $lat1);
        $deltaLng = deg2rad($lng2 - $lng1);

        $a = sin($deltaLat / 2) ** 2
            + cos($lat1Rad) * cos($lat2Rad) * sin($deltaLng / 2) ** 2;

        return self::EARTH_RADIUS_M * 2 * asin(min(1.0, sqrt($a)));
    }

    /**
     * The allowed check-in radius for a destination, in meters.
     */
    public function radiusFor(Destination $destination): int
    {
        $radius = $destination->radius_m;

        return is_numeric($radius) && (int) $radius > 0 ? (int) $radius : $this->defaultRadiusM;
    }

    /**
     * Verify a GPS check-in.
     *
     * @param  array{latitude: float, longitude: float, accuracy: float}  $position
     */
    public function verify(User $user, Destination $destination, array $position, ?Carbon $now = null): CheckInResult
    {
        $now ??= Carbon::now();

        $distance = (int) round($this->haversineMeters(
            (float) $destination->latitude,
            (float) $destination->longitude,
            $position['latitude'],
            $position['longitude'],
        ));
        $radius = $this->radiusFor($destination);
        $accuracy = (int) round($position['accuracy']);

        if ($accuracy > $this->maxAccuracyM) {
            return CheckInResult::fail(
                "Your GPS signal is too weak (accuracy ±{$accuracy} m). Step outside and try again.",
                reason: 'accuracy',
                distanceM: $distance,
                radiusM: $radius,
            );
        }

        if ($distance > $radius) {
            return CheckInResult::fail(
                "You are {$distance} m away — move within {$radius} m of {$destination->name} to check in.",
                reason: 'distance',
                distanceM: $distance,
                radiusM: $radius,
            );
        }

        $existing = $this->cooldownVisit($user, $destination, $now);

        if ($existing !== null) {
            return CheckInResult::fail(
                'You already verified a check-in here. Try again after '
                    .$existing->visited_at->copy()->addHours($this->cooldownHours)->diffForHumans().'.',
                reason: 'cooldown',
                distanceM: $distance,
                radiusM: $radius,
                existingVisit: $existing,
            );
        }

        if (($travel = $this->impossibleTravel($user, $position, $now)) !== null) {
            return CheckInResult::fail($travel, reason: 'speed', distanceM: $distance, radiusM: $radius);
        }

        return CheckInResult::pass($distance, $radius);
    }

    /**
     * The user's most recent verified visit to this destination, if it is still
     * inside the cooldown window.
     */
    public function cooldownVisit(User $user, Destination $destination, ?Carbon $now = null): ?Visit
    {
        $since = ($now ?? Carbon::now())->copy()->subHours($this->cooldownHours);

        return Visit::query()
            ->forUser($user)
            ->verified()
            ->where('destination_id', $destination->id)
            ->where('visited_at', '>=', $since)
            ->latest('visited_at')
            ->first();
    }

    /**
     * Detect implausible travel from the user's previous verified visit.
     *
     * @param  array{latitude: float, longitude: float, accuracy: float}  $position
     */
    private function impossibleTravel(User $user, array $position, Carbon $now): ?string
    {
        $previous = Visit::query()
            ->forUser($user)
            ->verified()
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->latest('visited_at')
            ->first();

        if ($previous === null) {
            return null;
        }

        $seconds = max($now->getTimestamp() - $previous->visited_at->getTimestamp(), 1);
        $distanceM = $this->haversineMeters(
            (float) $previous->latitude,
            (float) $previous->longitude,
            $position['latitude'],
            $position['longitude'],
        );
        $speedKmh = ($distanceM / 1000) / ($seconds / 3600);

        if ($speedKmh > $this->maxSpeedKmh) {
            return 'That check-in is '.round($speedKmh).' km/h away from your last verified visit — '
                .'this looks impossible. Please check in at your actual location.';
        }

        return null;
    }
}
