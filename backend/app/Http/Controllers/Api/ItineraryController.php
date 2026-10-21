<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreItineraryRequest;
use App\Http\Requests\UpdateItineraryRequest;
use App\Http\Resources\ItineraryResource;
use App\Http\Resources\ItinerarySummaryResource;
use App\Models\Itinerary;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ItineraryController extends Controller
{
    /**
     * Display the authenticated user's itineraries.
     */
    public function index(): AnonymousResourceCollection
    {
        $user = request()->user();

        $itineraries = Itinerary::query()
            ->whereBelongsTo($user)
            ->withCount('items')
            ->with(['items.destination' => fn ($query) => $query->withTrashed()])
            ->latest()
            ->paginate(20);

        $this->flagVerifiedStops($itineraries->getCollection(), $user);

        return ItineraryResource::collection($itineraries);
    }

    /**
     * Store a newly created itinerary.
     */
    public function store(StoreItineraryRequest $request): ItineraryResource
    {
        $itinerary = $request->user()->itineraries()->create(
            $request->safe()->only([
                'title',
                'description',
                'start_date',
                'end_date',
                'budget',
                'total_budget',
                'cover_image_url',
            ])
        );

        return new ItineraryResource($itinerary);
    }

    /**
     * Display the specified itinerary.
     */
    public function show(Itinerary $itinerary): ItineraryResource
    {
        Gate::authorize('view', $itinerary);

        return new ItineraryResource($itinerary->loadForDisplay(request()->user()));
    }

    /**
     * Update the specified itinerary.
     */
    public function update(UpdateItineraryRequest $request, Itinerary $itinerary): ItineraryResource
    {
        $itinerary->update($request->safe()->only([
            'title',
            'description',
            'start_date',
            'end_date',
            'budget',
            'total_budget',
            'cover_image_url',
        ]));

        return new ItineraryResource($itinerary->loadForDisplay($request->user()));
    }

    /**
     * Duplicate the itinerary and all of its stops.
     */
    public function duplicate(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('duplicate', $itinerary);

        $copy = DB::transaction(function () use ($itinerary) {
            $copy = $itinerary->replicate(['is_template', 'template_key']);
            $copy->title = 'Copy of '.$itinerary->title;
            $copy->is_template = false;
            $copy->template_key = null;
            $copy->save();

            $itinerary->load(['items.destination' => fn ($query) => $query->withTrashed()]);

            foreach ($itinerary->items as $item) {
                $copy->items()->create([
                    'destination_id' => $item->destination_id,
                    'custom_title' => $item->custom_title,
                    'custom_latitude' => $item->custom_latitude,
                    'custom_longitude' => $item->custom_longitude,
                    'custom_address' => $item->custom_address,
                    'day_number' => $item->day_number,
                    'order' => $item->order,
                    'start_time' => $item->start_time,
                    'duration_minutes' => $item->duration_minutes,
                    'category' => $item->category,
                    'estimated_budget' => $item->estimated_budget,
                    'notes' => $item->notes,
                    'status' => 'planned',
                    'visited' => false,
                ]);
            }

            return $copy;
        });

        return (new ItineraryResource($copy->loadForDisplay($itinerary->user)))
            ->response()
            ->setStatusCode(201);
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

        return new ItinerarySummaryResource($itinerary->load(['items.destination' => fn ($query) => $query->withTrashed()]));
    }

    /**
     * Flag the stops on a collection of itineraries with the user's verified
     * visit status in a couple of queries rather than one per stop.
     *
     * @param  Collection<int, Itinerary>  $itineraries
     */
    private function flagVerifiedStops($itineraries, $user): void
    {
        $destinationIds = $itineraries
            ->flatMap(fn (Itinerary $itinerary) => $itinerary->items->pluck('destination_id'))
            ->filter()
            ->unique()
            ->values();

        if ($destinationIds->isEmpty()) {
            return;
        }

        $verifiedIds = Visit::query()
            ->where('user_id', $user->id)
            ->verified()
            ->whereIn('destination_id', $destinationIds)
            ->pluck('destination_id')
            ->unique();

        $itineraries->each(function (Itinerary $itinerary) use ($verifiedIds) {
            $itinerary->items->each(function ($item) use ($verifiedIds) {
                $item->verified = $item->destination_id !== null
                    && $verifiedIds->contains($item->destination_id);
            });
        });
    }
}
