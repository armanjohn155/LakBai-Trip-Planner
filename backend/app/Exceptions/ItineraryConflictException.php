<?php

namespace App\Exceptions;

use App\Http\Resources\ItineraryResource;
use App\Models\Itinerary;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Thrown when a write carries a stale base_version. Renders a 409 with the
 * current server state so the client can reload without losing their edits.
 */
class ItineraryConflictException extends RuntimeException
{
    public function __construct(
        public readonly Itinerary $itinerary,
        public readonly ?string $subjectType = null,
        public readonly int|string|null $subjectId = null,
        string $message = 'This itinerary was changed by someone else. Reload the latest version.',
    ) {
        parent::__construct($message);
    }

    /**
     * Build the JSON response: 409 with the current itinerary snapshot and,
     * when relevant, the affected stop's fresh state.
     */
    public function render(): Response
    {
        $itinerary = $this->itinerary->loadForDisplay(request()->user());

        $payload = [
            'message' => $this->getMessage(),
            'conflict' => true,
            'data' => (new ItineraryResource($itinerary))->resolve(),
        ];

        if ($this->subjectType === 'stop' && $this->subjectId !== null) {
            $stop = $itinerary->items->firstWhere('id', (int) $this->subjectId);
            $payload['stop'] = $stop === null
                ? null
                : (new \App\Http\Resources\ItineraryItemResource($stop))->resolve();
        }

        return response()->json($payload, Response::HTTP_CONFLICT);
    }
}
