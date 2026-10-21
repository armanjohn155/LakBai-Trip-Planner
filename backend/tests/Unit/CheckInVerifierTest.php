<?php

namespace Tests\Unit;

use App\Models\Destination;
use App\Models\User;
use App\Models\Visit;
use App\Services\CheckInVerifier;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CheckInVerifierTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function verifier(): CheckInVerifier
    {
        return new CheckInVerifier(
            maxAccuracyM: 100,
            cooldownHours: 12,
            defaultRadiusM: 150,
            maxSpeedKmh: 900,
        );
    }

    public function test_haversine_distance_is_reasonable(): void
    {
        $meters = $this->verifier()->haversineMeters(10.0, 123.0, 10.0, 123.0);

        $this->assertSame(0.0, $meters);

        // ~0.001 degrees of latitude is about 111 meters.
        $meters = $this->verifier()->haversineMeters(10.0, 123.0, 10.001, 123.0);
        $this->assertEqualsWithDelta(111, $meters, 3);
    }

    public function test_check_in_passes_when_within_radius(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
            'radius_m' => 150,
        ]);

        $result = $this->verifier()->verify($user, $destination, [
            'latitude' => 10.0005,
            'longitude' => 123.0,
            'accuracy' => 20,
        ]);

        $this->assertTrue($result->ok);
        $this->assertLessThanOrEqual(150, $result->distanceM);
    }

    public function test_check_in_fails_when_outside_radius(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
            'radius_m' => 100,
        ]);

        $result = $this->verifier()->verify($user, $destination, [
            'latitude' => 10.05,
            'longitude' => 123.0,
            'accuracy' => 20,
        ]);

        $this->assertFalse($result->ok);
        $this->assertSame('distance', $result->reason);
    }

    public function test_check_in_fails_when_accuracy_is_too_low(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
        ]);

        $result = $this->verifier()->verify($user, $destination, [
            'latitude' => 10.0,
            'longitude' => 123.0,
            'accuracy' => 250,
        ]);

        $this->assertFalse($result->ok);
        $this->assertSame('accuracy', $result->reason);
    }

    public function test_check_in_enforces_cooldown(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
        ]);

        Visit::factory()->verified()->create([
            'user_id' => $user->id,
            'destination_id' => $destination->id,
            'visited_at' => Carbon::now()->subHour(),
        ]);

        $result = $this->verifier()->verify($user, $destination, [
            'latitude' => 10.0,
            'longitude' => 123.0,
            'accuracy' => 10,
        ]);

        $this->assertFalse($result->ok);
        $this->assertSame('cooldown', $result->reason);
        $this->assertNotNull($result->existingVisit);
    }

    public function test_check_in_allows_after_cooldown_expires(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
        ]);

        Visit::factory()->verified()->create([
            'user_id' => $user->id,
            'destination_id' => $destination->id,
            'visited_at' => Carbon::now()->subHours(13),
        ]);

        $result = $this->verifier()->verify($user, $destination, [
            'latitude' => 10.0,
            'longitude' => 123.0,
            'accuracy' => 10,
        ]);

        $this->assertTrue($result->ok);
    }

    public function test_check_in_rejects_impossible_travel(): void
    {
        $user = User::factory()->create();
        $destination = Destination::factory()->create([
            'latitude' => 10.0,
            'longitude' => 123.0,
        ]);

        // A verified visit far away, one minute ago.
        Visit::factory()->verified()->create([
            'user_id' => $user->id,
            'destination_id' => Destination::factory(),
            'latitude' => 14.6,
            'longitude' => 121.0,
            'visited_at' => Carbon::now()->subMinute(),
        ]);

        $result = $this->verifier()->verify($user, $destination, [
            'latitude' => 10.0,
            'longitude' => 123.0,
            'accuracy' => 10,
        ]);

        $this->assertFalse($result->ok);
        $this->assertSame('speed', $result->reason);
    }
}
