<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreItineraryRequest;
use App\Http\Requests\UpdateItineraryRequest;
use App\Http\Resources\ItineraryResource;
use App\Http\Resources\ItinerarySummaryResource;
use App\Models\Itinerary;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class ItineraryController extends Controller
{
    /**
     * Display the authenticated user's itineraries.
     */
    public function index(): AnonymousResourceCollection
    {
        $itineraries = Itinerary::query()
            ->whereBelongsTo(request()->user())
            ->withCount('items')
            ->with('items.destination')
            ->latest()
            ->paginate(20);

        return ItineraryResource::collection($itineraries);
    }

    /**
     * Store a newly created itinerary.
     */
    public function store(StoreItineraryRequest $request): ItineraryResource
    {
        $itinerary = $request->user()->itineraries()->create(
            $request->safe()->only(['title', 'start_date', 'end_date', 'budget'])
        );

        return new ItineraryResource($itinerary);
    }

    /**
     * Display the specified itinerary.
     */
    public function show(Itinerary $itinerary): ItineraryResource
    {
        Gate::authorize('view', $itinerary);

        return new ItineraryResource($itinerary->load('items.destination'));
    }

    /**
     * Update the specified itinerary.
     */
    public function update(UpdateItineraryRequest $request, Itinerary $itinerary): ItineraryResource
    {
        $itinerary->update($request->safe()->only(['title', 'start_date', 'end_date', 'budget']));

        return new ItineraryResource($itinerary);
    }

    /**
     * Remove the specified itinerary.
     */
    public function destroy(Itinerary $itinerary): Response
    {
        Gate::authorize('delete', $itinerary);

        $itinerary->delete();

        return response()->noContent();
    }

    /**
     * Display the total estimated budget breakdown for the itinerary.
     */
    public function summary(Itinerary $itinerary): ItinerarySummaryResource
    {
        Gate::authorize('view', $itinerary);

        return new ItinerarySummaryResource($itinerary->load('items.destination'));
    }
}
