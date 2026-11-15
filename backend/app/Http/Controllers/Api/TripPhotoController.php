<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TripPhotoResource;
use App\Models\Itinerary;
use App\Models\TripPhoto;
use App\Services\TripPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TripPhotoController extends Controller
{
    public function __construct(private readonly TripPhotoService $photos) {}

    /**
     * Photos on a recap. Members only; hidden photos are still returned to
     * members but the public payload filters them out.
     */
    public function index(Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $photos = TripPhoto::query()
            ->where('itinerary_id', $itinerary->id)
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => TripPhotoResource::collection($photos)->resolve(request()),
        ]);
    }

    /**
     * Upload one photo. Owners and editors may upload; viewers may not.
     */
    public function store(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('create', [TripPhoto::class, $itinerary]);

        $validated = $request->validate([
            'photo' => [
                'required',
                'file',
                'image',
                'mimetypes:image/jpeg,image/png,image/webp',
                'max:'.(int) config('lakbai.recap.max_photo_kb', 5120),
            ],
            'caption' => ['nullable', 'string', 'max:200'],
            'taken_at' => ['nullable', 'date'],
            'itinerary_item_id' => ['nullable', 'integer'],
        ], [
            'photo.mimetypes' => 'Photos must be JPG, PNG or WebP images.',
            'photo.max' => 'Each photo must be 5 MB or smaller.',
        ]);

        $photo = $this->photos->upload(
            $itinerary,
            $request->user(),
            $request->file('photo'),
            [
                'caption' => $validated['caption'] ?? null,
                'taken_at' => $validated['taken_at'] ?? null,
                'itinerary_item_id' => $validated['itinerary_item_id'] ?? null,
            ],
        );

        return (new TripPhotoResource($photo))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Edit a caption, linked stop or hidden flag on your own photo. The trip
     * owner may moderate any photo; other editors may only touch their own.
     */
    public function update(Request $request, Itinerary $itinerary, TripPhoto $photo): TripPhotoResource
    {
        Gate::authorize('update', $photo);

        $validated = $request->validate([
            'caption' => ['sometimes', 'nullable', 'string', 'max:200'],
            'taken_at' => ['sometimes', 'nullable', 'date'],
            'itinerary_item_id' => ['sometimes', 'nullable', 'integer'],
            'is_hidden' => ['sometimes', 'boolean'],
        ]);

        return new TripPhotoResource($this->photos->update($photo, $validated));
    }

    /**
     * Drag-and-drop order for the gallery. Editors and owners may reorder.
     */
    public function reorder(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('update', $itinerary);

        $validated = $request->validate([
            'photos' => ['required', 'array', 'min:1'],
            'photos.*' => ['required', 'integer', Rule::exists('trip_photos', 'id')->whereNull('deleted_at')],
        ]);

        $this->photos->reorder($itinerary, array_map('intval', $validated['photos']));

        $photos = TripPhoto::query()
            ->where('itinerary_id', $itinerary->id)
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => TripPhotoResource::collection($photos)->resolve(request()),
        ]);
    }

    /**
     * Delete your own photo (or any photo as the trip owner).
     */
    public function destroy(Itinerary $itinerary, TripPhoto $photo): Response
    {
        Gate::authorize('delete', $photo);

        $this->photos->delete($photo);

        return response()->noContent();
    }
}
