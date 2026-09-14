<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DestinationResource;
use App\Models\Destination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DestinationController extends Controller
{
    /**
     * Display a filtered, paginated listing of destinations.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $destinations = Destination::query()
            ->filter($request->only(['category', 'region', 'search', 'min_price', 'max_price']))
            ->when($request->user() !== null, fn (Builder $query) => $query->with('favoritedBy'))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        return DestinationResource::collection($destinations);
    }

    /**
     * Display the specified destination.
     */
    public function show(Destination $destination, Request $request): DestinationResource
    {
        if ($request->user() !== null) {
            $destination->load('favoritedBy');
        }

        return new DestinationResource($destination);
    }
}
