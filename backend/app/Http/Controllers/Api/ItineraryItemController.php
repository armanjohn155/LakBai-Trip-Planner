<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreItineraryItemRequest;
use App\Http\Requests\UpdateItineraryItemRequest;
use App\Http\Resources\ItineraryResource;
use App\Models\Itinerary;
use App\Models\ItineraryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class ItineraryItemController extends Controller
{
    /**
     * Add a destination to the itinerary.
     */
    public function store(StoreItineraryItemRequest $request, Itinerary $itinerary): JsonResponse
    {
        $dayNumber = $request->integer('day_number', 1);
        $order = $request->integer('order', ItineraryItem::query()
            ->whereBelongsTo($itinerary, 'itinerary')
            ->where('day_number', $dayNumber)
            ->count());

        $itinerary->items()->create([
            'destination_id' => $request->integer('destination_id'),
            'day_number' => $dayNumber,
            'order' => $order,
            'estimated_budget' => $request->input('estimated_budget'),
            'notes' => $request->input('notes'),
            'visited' => $request->boolean('visited'),
        ]);

        return (new ItineraryResource($itinerary->load('items.destination')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update the specified itinerary item.
     */
    public function update(
        UpdateItineraryItemRequest $request,
        Itinerary $itinerary,
        ItineraryItem $item
    ): ItineraryResource {
        Gate::authorize('update', $item);

        $item->update($request->safe()->only([
            'destination_id',
            'day_number',
            'order',
            'estimated_budget',
            'notes',
            'visited',
        ]));

        return new ItineraryResource($itinerary->load('items.destination'));
    }

    /**
     * Remove the specified itinerary item.
     */
    public function destroy(Itinerary $itinerary, ItineraryItem $item): Response
    {
        Gate::authorize('delete', $item);

        $item->delete();

        return response()->noContent();
    }
}
