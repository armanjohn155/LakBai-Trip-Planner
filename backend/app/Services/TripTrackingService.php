<?php

namespace App\Services;

use App\Models\Itinerary;
use App\Models\TrackingPoint;
use App\Models\TrackingSession;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Server-side GPS batch ingestion for solo live tracking.
 *
 * The client is untrusted: accuracy, point age, impossible jumps, jitter and
 * route gaps are all filtered here before distance is accumulated.
 */
class TripTrackingService
{
    public function __construct(
        private readonly CheckInVerifier $verifier,
        private readonly GroupTrackingService $group,
    ) {}

    /**
     * @param  array<int, array{lat: float|int|string, lng: float|int|string, accuracy?: float|int|string|null, speed?: float|int|string|null, recorded_at: string}>  $points
     * @return array{ok: bool, status?: int, message?: string, accepted: int, rejected: int, distance_m: int, session_status: string|null}
     */
    public function ingest(Itinerary $itinerary, User $user, array $points, ?Carbon $now = null): array
    {
        $now ??= Carbon::now();

        if ($itinerary->lifecycle_status !== Itinerary::LIFECYCLE_ACTIVE) {
            return [
                'ok' => false,
                'status' => 409,
                'message' => 'Tracking only runs while the trip is active.',
                'accepted' => 0,
                'rejected' => count($points),
                'distance_m' => (int) $itinerary->distance_m,
                'session_status' => null,
            ];
        }

        $session = TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->whereBelongsTo($user)
            ->where('status', TrackingSession::STATUS_ACTIVE)
            ->latest('started_at')
            ->first();

        if ($session === null) {
            return [
                'ok' => false,
                'status' => 409,
                'message' => 'Start tracking before sending location points.',
                'accepted' => 0,
                'rejected' => count($points),
                'distance_m' => (int) $itinerary->distance_m,
                'session_status' => null,
            ];
        }

        $maxAccuracy = (int) config('lakbai.tracking.max_accuracy_m', 100);
        $maxFuture = (int) config('lakbai.tracking.max_future_seconds', 60);
        $maxAge = (int) config('lakbai.tracking.max_point_age_seconds', 600);
        $maxJump = (float) config('lakbai.tracking.max_jump_speed_kmh', 200);
        $minDistance = (float) config('lakbai.tracking.min_distance_m', 5);
        $maxGap = (int) config('lakbai.tracking.max_gap_seconds', 300);
        $sampleSeconds = (int) config('lakbai.tracking.sample_seconds', 10);

        $lastStoredAt = TrackingPoint::query()
            ->where('tracking_session_id', $session->id)
            ->max('recorded_at');

        $lastLat = $session->last_lat !== null ? (float) $session->last_lat : null;
        $lastLng = $session->last_lng !== null ? (float) $session->last_lng : null;
        $lastAt = $session->last_point_at;
        $lastAccuracy = $session->last_accuracy_m;

        $accepted = 0;
        $rejected = 0;
        $distanceAdded = 0.0;
        $movingAdded = 0;

        $sorted = collect($points)
            ->filter(fn ($point) => is_array($point) && isset($point['lat'], $point['lng'], $point['recorded_at']))
            ->sortBy(fn ($point) => (string) $point['recorded_at'])
            ->values();

        foreach ($sorted as $point) {
            $accuracy = isset($point['accuracy']) && is_numeric($point['accuracy'])
                ? (float) $point['accuracy']
                : $maxAccuracy + 1;

            if ($accuracy < 0 || $accuracy > $maxAccuracy) {
                $rejected++;

                continue;
            }

            try {
                $recordedAt = Carbon::parse((string) $point['recorded_at']);
            } catch (\Throwable) {
                $rejected++;

                continue;
            }

            if ($recordedAt->getTimestamp() > $now->getTimestamp() + $maxFuture) {
                $rejected++;

                continue;
            }

            if ($recordedAt->getTimestamp() < $now->getTimestamp() - $maxAge) {
                $rejected++;

                continue;
            }

            $lat = (float) $point['lat'];
            $lng = (float) $point['lng'];

            $computedSpeed = null;

            if ($lastLat !== null && $lastLng !== null && $lastAt !== null) {
                $seconds = $recordedAt->getTimestamp() - $lastAt->getTimestamp();

                if ($seconds > 0) {
                    $jumpMetres = $this->verifier->haversineMeters($lastLat, $lastLng, $lat, $lng);
                    $computedSpeed = ($jumpMetres / $seconds) * 3.6;

                    if ($computedSpeed > $maxJump) {
                        $rejected++;

                        continue;
                    }

                    if ($seconds <= $maxGap) {
                        if ($jumpMetres >= $minDistance) {
                            $distanceAdded += $jumpMetres;
                            $movingAdded += $seconds;
                        }
                    }
                }
            }

            $accepted++;
            $lastLat = $lat;
            $lastLng = $lng;
            $lastAt = $recordedAt;
            $lastAccuracy = (int) round($accuracy);

            $shouldStore = $lastStoredAt === null
                || $recordedAt->getTimestamp() - Carbon::parse($lastStoredAt)->getTimestamp() >= $sampleSeconds;

            if ($shouldStore) {
                TrackingPoint::query()->create([
                    'tracking_session_id' => $session->id,
                    'lat' => $lat,
                    'lng' => $lng,
                    'accuracy_m' => (int) round($accuracy),
                    'speed_mps' => isset($point['speed']) && is_numeric($point['speed'])
                        ? (float) $point['speed']
                        : ($computedSpeed !== null ? round($computedSpeed / 3.6, 2) : null),
                    'recorded_at' => $recordedAt,
                ]);

                $lastStoredAt = $recordedAt->toDateTimeString();
            }
        }

        if ($accepted > 0) {
            $session->forceFill([
                'distance_m' => (int) $session->distance_m + (int) round($distanceAdded),
                'last_lat' => $lastLat,
                'last_lng' => $lastLng,
                'last_accuracy_m' => $lastAccuracy,
                'last_point_at' => $lastAt,
            ])->save();

            $itinerary->forceFill([
                'distance_m' => (int) $itinerary->distance_m + (int) round($distanceAdded),
                'moving_seconds' => (int) $itinerary->moving_seconds + $movingAdded,
            ])->saveQuietly();

            if ($lastLat !== null && $lastLng !== null && $lastAt !== null) {
                $this->group->recordMemberPosition($itinerary, $user, $session, [
                    'lat' => $lastLat,
                    'lng' => $lastLng,
                    'accuracy_m' => $lastAccuracy,
                    'recorded_at' => $lastAt->toIso8601String(),
                ], $now);
            }
        }

        return [
            'ok' => true,
            'accepted' => $accepted,
            'rejected' => $rejected,
            'distance_m' => (int) $itinerary->distance_m,
            'session_status' => $session->status,
        ];
    }

    /**
     * Everything the live bar needs in one request.
     *
     * @return array<string, mixed>
     */
    public function summary(Itinerary $itinerary, User $user, ?Carbon $now = null): array
    {
        $now ??= Carbon::now();

        $session = TrackingSession::query()
            ->whereBelongsTo($itinerary)
            ->whereBelongsTo($user)
            ->latest('started_at')
            ->first();

        $elapsed = 0;

        if ($itinerary->started_at !== null) {
            $elapsed = max(0, $now->getTimestamp() - $itinerary->started_at->getTimestamp());
            $elapsed -= (int) $itinerary->total_paused_seconds;

            if ($itinerary->paused_at !== null) {
                $elapsed -= max(0, $now->getTimestamp() - $itinerary->paused_at->getTimestamp());
            }

            $elapsed = max(0, $elapsed);
        }

        $lastPosition = null;

        if ($session !== null && $session->last_lat !== null && $session->last_lng !== null) {
            $lastPosition = [
                'lat' => (float) $session->last_lat,
                'lng' => (float) $session->last_lng,
                'accuracy_m' => $session->last_accuracy_m,
                'recorded_at' => $session->last_point_at?->toIso8601String(),
            ];
        }

        $next = $itinerary->items()
            ->with('destination')
            ->whereIn('status', ['planned', 'arrived'])
            ->orderBy('day_number')
            ->orderBy('order')
            ->first();

        $nextStop = null;

        if ($next !== null) {
            $coords = $next->resolvedCoordinates();
            $distance = null;
            $bearing = null;

            if ($coords !== null && $lastPosition !== null) {
                $distance = (int) round($this->verifier->haversineMeters(
                    $lastPosition['lat'],
                    $lastPosition['lng'],
                    $coords[0],
                    $coords[1],
                ));
                $bearing = (int) round($this->bearing(
                    $lastPosition['lat'],
                    $lastPosition['lng'],
                    $coords[0],
                    $coords[1],
                ));
            }

            $nextStop = [
                'id' => $next->id,
                'title' => $next->resolvedTitle(),
                'day_number' => $next->day_number,
                'order' => $next->order,
                'latitude' => $coords[0] ?? null,
                'longitude' => $coords[1] ?? null,
                'status' => $next->status,
                'distance_m' => $distance,
                'bearing' => $bearing,
            ];
        }

        return [
            'itinerary_id' => $itinerary->id,
            'lifecycle_status' => $itinerary->lifecycle_status,
            'session_status' => $session?->status ?? 'inactive',
            'distance_m' => (int) $itinerary->distance_m,
            'elapsed_seconds' => $elapsed,
            'moving_seconds' => (int) $itinerary->moving_seconds,
            'last_position' => $lastPosition,
            'next_stop' => $nextStop,
            'can_finish' => $itinerary->canFinish(),
            'started_at' => $itinerary->started_at?->toIso8601String(),
            'paused_at' => $itinerary->paused_at?->toIso8601String(),
        ];
    }

    /**
     * Delete raw points for finished trips past the retention window while
     * keeping the session row and the simplified distance/time stats.
     */
    public function prunePoints(?int $days = null, ?Carbon $now = null): int
    {
        $days ??= (int) config('lakbai.tracking.retention_days', 90);
        $cutoff = ($now ?? Carbon::now())->copy()->subDays($days);

        $sessionIds = TrackingSession::query()
            ->where('ended_at', '<=', $cutoff)
            ->whereHas('itinerary', fn ($query) => $query
                ->whereIn('lifecycle_status', [Itinerary::LIFECYCLE_COMPLETED, Itinerary::LIFECYCLE_CANCELLED]))
            ->pluck('id');

        if ($sessionIds->isEmpty()) {
            return 0;
        }

        return TrackingPoint::query()->whereIn('tracking_session_id', $sessionIds)->delete();
    }

    private function bearing(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $lat1 = deg2rad($lat1);
        $lat2 = deg2rad($lat2);
        $deltaLng = deg2rad($lng2 - $lng1);

        $y = sin($deltaLng) * cos($lat2);
        $x = cos($lat1) * sin($lat2) - sin($lat1) * cos($lat2) * cos($deltaLng);

        return fmod(rad2deg(atan2($y, $x)) + 360, 360);
    }
}
