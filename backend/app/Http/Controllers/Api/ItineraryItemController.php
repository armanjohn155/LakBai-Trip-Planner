<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreItineraryItemRequest;
use App\Http\Requests\UpdateItineraryItemRequest;
use App\Http\Resources\ItineraryResource;
use App\Models\Destination;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ItineraryItemController extends Controller
{
    /**
     * Add a stop (destination-backed or custom) to the itinerary.
     */
    public function store(StoreItineraryItemRequest $request, Itinerary $itinerary): JsonResponse
    {
        $dayNumber = $request->integer('day_number', 1);
        $order = $request->integer('order', ItineraryItem::query()
            ->whereBelongsTo($itinerary, 'itinerary')
            ->where('day_number', $dayNumber)
            ->count());

        $destinationId = $request->input('destination_id');

        $itinerary->items()->create([
            'destination_id' => $destinationId,
            'custom_title' => $destinationId === null ? $request->input('custom_title') : null,
            'custom_latitude' => $destinationId === null ? $request->input('custom_latitude') : null,
            'custom_longitude' => $destinationId === null ? $request->input('custom_longitude') : null,
            'custom_address' => $destinationId === null ? $request->input('custom_address') : null,
            'day_number' => $dayNumber,
            'order' => $order,
            'start_time' => $request->input('start_time'),
            'duration_minutes' => $request->input('duration_minutes'),
            'category' => $request->input('category'),
            'estimated_budget' => $this->resolveBudget($request, $destinationId),
            'notes' => $request->input('notes'),
            'visited' => $request->boolean('visited'),
            'status' => $request->input('status', 'planned'),
        ]);

        return (new ItineraryResource($itinerary->loadForDisplay($request->user())))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update the specified itinerary stop.
     */
    public function update(
        UpdateItineraryItemRequest $request,
        Itinerary $itinerary,
        ItineraryItem $item
    ): ItineraryResource {
        Gate::authorize('update', $item);

        $attributes = $request->safe()->only([
            'destination_id',
            'custom_title',
            'custom_latitude',
            'custom_longitude',
            'custom_address',
            'day_number',
            'order',
            'start_time',
            'duration_minutes',
            'category',
            'estimated_budget',
            'notes',
            'visited',
            'status',
        ]);

        // Switching to a destination clears any custom details, and vice versa.
        if (array_key_exists('destination_id', $attributes) && $attributes['destination_id'] !== null) {
            $attributes['custom_title'] = null;
            $attributes['custom_latitude'] = null;
            $attributes['custom_longitude'] = null;
            $attributes['custom_address'] = null;
        }

        $item->update($attributes);

        return new ItineraryResource($itinerary->loadForDisplay($request->user()));
    }

    /**
     * Remove the specified itinerary stop.
     */
    public function destroy(Itinerary $itinerary, ItineraryItem $item): Response
    {
        Gate::authorize('delete', $item);

        $item->delete();

        return response()->noContent();
    }

    /**
     * Bulk reorder/re-day stops in a single transaction. Positions are then
     * normalised to 1..n within each day.
     */
    public function reorder(Request $request, Itinerary $itinerary): ItineraryResource
    {
        Gate::authorize('update', $itinerary);

        // Accept either a bare array [{id, day_number, order}] or {stops: [...]}.
        $payload = $request->input('stops', $request->all());

        $validated = validator(
            ['stops' => $payload],
            [
                'stops' => ['required', 'array'],
                'stops.*.id' => ['required', 'integer'],
                'stops.*.day_number' => ['required', 'integer', 'min:1', 'max:30'],
                'stops.*.order' => ['required', 'integer', 'min:0'],
            ]
        )->validate();

        $stopIds = collect($validated['stops'])->pluck('id');

        $ownedCount = $itinerary->items()->whereIn('id', $stopIds)->count();

        if ($ownedCount !== $stopIds->unique()->count()) {
            throw ValidationException::withMessages([
                'stops' => 'One or more stops do not belong to this itinerary.',
            ]);
        }

        DB::transaction(function () use ($validated, $itinerary) {
            // Group by target day, order within the day, then renumber to 1..n.
            $byDay = collect($validated['stops'])
                ->groupBy('day_number')
                ->sortKeys();

            foreach ($byDay as $dayNumber => $stops) {
                $position = 1;

                foreach ($stops->sortBy('order')->values() as $stop) {
                    $itinerary->items()
                        ->whereKey($stop['id'])
                        ->update(['day_number' => $dayNumber, 'order' => $position]);

                    $position++;
                }
            }
        });

        return new ItineraryResource($itinerary->loadForDisplay($request->user()));
    }

    /**
     * Budget defaults to the destination's estimated cost when omitted.
     */
    private function resolveBudget(StoreItineraryItemRequest $request, mixed $destinationId): mixed
    {
        if ($request->filled('estimated_budget')) {
            return $request->input('estimated_budget');
        }

        if ($destinationId === null) {
            return null;
        }

        return Destination::query()->whereKey($destinationId)->value('estimated_cost');
    }
}
