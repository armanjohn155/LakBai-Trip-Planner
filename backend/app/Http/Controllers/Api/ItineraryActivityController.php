<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ItineraryActivityResource;
use App\Models\Itinerary;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;

class ItineraryActivityController extends Controller
{
    /**
     * Paginated activity feed visible to all members.
     */
    public function index(Itinerary $itinerary): AnonymousResourceCollection
    {
        Gate::authorize('view', $itinerary);

        $activities = $itinerary->activities()->with('user:id,name')->paginate(30);

        return ItineraryActivityResource::collection($activities);
    }
}
