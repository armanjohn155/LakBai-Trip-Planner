<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ItineraryResource;
use App\Http\Resources\ItineraryTemplateResource;
use App\Models\Itinerary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ItineraryTemplateController extends Controller
{
    /**
     * List admin-curated itinerary templates.
     */
    public function index(): AnonymousResourceCollection
    {
        $templates = Itinerary::query()
            ->templates()
            ->withCount('items')
            ->with(['items.destination' => fn ($query) => $query->withTrashed()])
            ->orderBy('title')
            ->get();

        return ItineraryTemplateResource::collection($templates);
    }

    /**
     * Clone a template into the authenticated user's itineraries.
     */
    public function use(Request $request, int $template): JsonResponse
    {
        /** @var Itinerary $source */
        $source = Itinerary::query()
            ->templates()
            ->with(['items.destination' => fn ($query) => $query->withTrashed()])
            ->findOrFail($template);

        $user = $request->user();

        $copy = DB::transaction(function () use ($source, $user) {
            $copy = $user->itineraries()->create([
                'title' => $source->title,
                'description' => $source->description,
                'start_date' => null,
                'end_date' => null,
                'budget' => $source->budget,
                'total_budget' => $source->total_budget,
                'cover_image_url' => $source->cover_image_url,            ]);

            foreach ($source->items as $item) {
                // Soft-deleted destinations are copied as plain custom stops so
                // the cloned itinerary never points at an unavailable place.
                $destinationId = $item->destination_id;
                $destination = $destinationId !== null ? $item->destination : null;
                $destinationMissing = $destinationId !== null
                    && ($destination === null || $destination->trashed());

                $copy->items()->create([
                    'destination_id' => $destinationMissing ? null : $destinationId,
                    'custom_title' => $destinationMissing
                        ? ($item->custom_title ?? $destination?->name ?? 'Unavailable stop')
                        : $item->custom_title,
                    'custom_latitude' => $destinationMissing
                        ? ($item->custom_latitude ?? $destination?->latitude)
                        : $item->custom_latitude,
                    'custom_longitude' => $destinationMissing
                        ? ($item->custom_longitude ?? $destination?->longitude)
                        : $item->custom_longitude,
                    'custom_address' => $item->custom_address,
                    'day_number' => $item->day_number,
                    'order' => $item->order,
                    'start_time' => $item->start_time,
                    'duration_minutes' => $item->duration_minutes,
                    'category' => $item->category ?? ($destinationMissing ? 'Other' : null),
                    'estimated_budget' => $item->estimated_budget,
                    'notes' => $item->notes,
                    'status' => 'planned',
                    'visited' => false,
                ]);
            }

            return $copy;
        });

        return (new ItineraryResource($copy->loadForDisplay($user)))
            ->response()
            ->setStatusCode(201);
    }
}
