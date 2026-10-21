<?php

namespace App\Services;

use App\Models\Visit;

/**
 * Outcome of a check-in verification attempt.
 */
final class CheckInResult
{
    private function __construct(
        public readonly bool $ok,
        public readonly ?string $message,
        public readonly ?string $reason,
        public readonly int $distanceM,
        public readonly int $radiusM,
        public readonly ?Visit $existingVisit,
    ) {}

    public static function pass(int $distanceM, int $radiusM): self
    {
        return new self(true, null, null, $distanceM, $radiusM, null);
    }

    public static function fail(
        string $message,
        string $reason,
        int $distanceM,
        int $radiusM,
        ?Visit $existingVisit = null,
    ): self {
        return new self(false, $message, $reason, $distanceM, $radiusM, $existingVisit);
    }
}
