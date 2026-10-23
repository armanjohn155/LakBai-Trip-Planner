<?php

namespace App\Services;

use App\Exceptions\ItineraryConflictException;
use App\Models\Itinerary;

/**
 * Optimistic-concurrency guard for group editing.
 *
 * Rule (kept deliberately simple and predictable):
 *
 *   A write may carry an optional integer `base_version`.
 *   - When it is absent, the write always proceeds (legacy clients, owner-only
 *     flows and first-time edits keep working unchanged).
 *   - When it is present and is LESS THAN the itinerary's current version, the
 *     client's snapshot is stale: a 409 is thrown with the fresh server state
 *     so the client can reload. A stale reorder returns 409 with the current
 *     order; a stale stop write returns 409 with that stop's latest values.
 *   - A `base_version` that is greater than or equal to the current version is
 *     accepted (equal = up-to-date; greater cannot happen legitimately and is
 *     treated as up-to-date rather than blocking the user).
 *
 * The version is incremented in the same transaction as every successful write
 * by ItineraryActivityLogger::recordChange().
 */
class ItineraryConflictGuard
{
    public function assertFresh(Itinerary $itinerary, mixed $baseVersion, ?string $subjectType = null, int|string|null $subjectId = null): void
    {
        if ($baseVersion === null || $baseVersion === '') {
            return;
        }

        if (! is_numeric($baseVersion)) {
            return;
        }

        if ((int) $baseVersion < $itinerary->version) {
            throw new ItineraryConflictException($itinerary, $subjectType, $subjectId);
        }
    }
}
