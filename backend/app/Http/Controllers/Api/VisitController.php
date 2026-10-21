<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckInRequest;
use App\Http\Requests\ManualVisitRequest;
use App\Http\Resources\VisitResource;
use App\Models\Destination;
use App\Models\Visit;
use App\Services\CheckInVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class VisitController extends Controller
{
    public function __construct(private readonly CheckInVerifier $verifier) {}

    /**
     * Record a GPS-verified check-in for the authenticated user.
     */
    public function checkIn(CheckInRequest $request, Destination $destination): JsonResponse
    {
        if ($destination->trashed()) {
            return response()->json([
                'message' => 'This destination is no longer available for check-ins.',
            ], 422);
        }

        $position = [
            'latitude' => (float) $request->input('latitude'),
            'longitude' => (float) $request->input('longitude'),
            'accuracy' => (float) $request->input('accuracy'),
        ];

        $result = $this->verifier->verify($request->user(), $destination, $position);

        if (! $result->ok) {
            $payload = [
                'message' => $result->message,
                'reason' => $result->reason,
                'distance_m' => $result->distanceM,
                'radius_m' => $result->radiusM,
            ];

            if ($result->existingVisit !== null) {
                $payload['visit'] = new VisitResource($result->existingVisit->load('destination'));
            }

            // A cooldown is a "already done" conflict; other failures are validation.
            return response()->json($payload, $result->reason === 'cooldown' ? 429 : 422);
        }

        $visit = Visit::create([
            'user_id' => $request->user()->id,
            'destination_id' => $destination->id,
            'itinerary_stop_id' => $request->input('itinerary_stop_id'),
            'verified' => true,
            'method' => 'gps',
            'latitude' => $position['latitude'],
            'longitude' => $position['longitude'],
            'distance_m' => $result->distanceM,
            'accuracy_m' => (int) round($position['accuracy']),
            'visited_at' => Carbon::now(),
            'notes' => $request->input('notes'),
        ]);

        return (new VisitResource($visit->load('destination')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Record an honest-but-unverified manual visit.
     */
    public function manual(ManualVisitRequest $request, Destination $destination): JsonResponse
    {
        if ($destination->trashed()) {
            return response()->json([
                'message' => 'This destination is no longer available for check-ins.',
            ], 422);
        }

        $visit = Visit::create([
            'user_id' => $request->user()->id,
            'destination_id' => $destination->id,
            'itinerary_stop_id' => $request->input('itinerary_stop_id'),
            'verified' => false,
            'method' => 'manual',
            'visited_at' => Carbon::parse($request->input('visited_at')),
            'notes' => $request->input('notes'),
        ]);

        return (new VisitResource($visit->load('destination')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Remove one of the authenticated user's visits.
     */
    public function destroy(Visit $visit): Response
    {
        Gate::authorize('delete', $visit);

        $visit->delete();

        return response()->noContent();
    }
}
