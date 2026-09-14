<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DestinationResource;
use App\Models\Destination;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class FavoritesController extends Controller
{
    /**
     * Display the authenticated user's favorite destinations.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $destinations = $request->user()->favoriteDestinations()
            ->with('favoritedBy')
            ->paginate(20);

        return DestinationResource::collection($destinations);
    }

    /**
     * Add a destination to the authenticated user's favorites.
     */
    public function store(Request $request, Destination $destination): DestinationResource
    {
        $request->user()->favoriteDestinations()->syncWithoutDetaching([$destination->id]);

        $destination->load('favoritedBy');

        return new DestinationResource($destination);
    }

    /**
     * Remove a destination from the authenticated user's favorites.
     */
    public function destroy(Request $request, Destination $destination): Response
    {
        $request->user()->favoriteDestinations()->detach($destination->id);

        return response()->noContent();
    }
}
