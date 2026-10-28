<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDestinationRequest;
use App\Http\Requests\Admin\UpdateDestinationRequest;
use App\Http\Resources\DestinationResource;
use App\Models\Destination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DestinationController extends Controller
{
    /**
     * The sortable columns exposed on the admin destination index.
     *
     * @var list<string>
     */
    private const SORTABLE = ['name', 'created_at', 'updated_at', 'estimated_cost', 'rating'];

    /**
     * Display a paginated, searchable listing of destinations for admins.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $status = $request->string('status')->toString();

        $destinations = Destination::query()
            ->when($status === 'trashed', fn (Builder $query) => $query->onlyTrashed())
            ->when($status === 'all', fn (Builder $query) => $query->withTrashed())
            ->when($request->filled('search'), function (Builder $query) use ($request) {
                $search = $request->string('search')->toString();

                $query->where(function (Builder $inner) use ($search) {
                    $connection = $inner->getConnection()->getDriverName();
                    if ($connection === 'pgsql') {
                        $inner->where('name', 'ilike', "%{$search}%")
                            ->orWhere('municipality', 'ilike', "%{$search}%");
                    } else {
                        $inner->where('name', 'like', "%{$search}%")
                            ->orWhere('municipality', 'like', "%{$search}%");
                    }
                });
            })
            ->when($request->filled('category'), fn (Builder $query) => $query->where('category', $request->string('category')->toString()))
            ->when($request->filled('region'), fn (Builder $query) => $query->where('region', $request->string('region')->toString()))
            ->orderBy(...$this->parseSort($request->string('sort', 'name')->toString()))
            ->paginate($request->integer('per_page', 20));

        return DestinationResource::collection($destinations);
    }

    /**
     * Store a newly created destination.
     */
    public function store(StoreDestinationRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Never accept source/created_by from request input
        unset($data['source'], $data['created_by'], $data['rating'], $data['review_count']);

        // Handle multiple images
        $gallery = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                if (! is_array($file) && $file) {
                    $gallery[] = $this->storeUploadedImage($file, $data['name'] ?? 'destination');
                }
            }
        }
        unset($data['images'], $data['cover_index']);

        // Handle single image (backward compatible)
        if ($request->hasFile('image')) {
            $imageUrl = $this->storeUploadedImage($request->file('image'), $data['name'] ?? 'destination');
            $data['image_url'] = $imageUrl;
            if (empty($gallery)) {
                $gallery[] = $imageUrl;
            }
        }
        unset($data['image']);

        // Normalize arrays if they come as JSON strings (FormData)
        $arrayFields = ['highlights', 'how_to_get_there', 'travel_tips', 'gallery'];
        foreach ($arrayFields as $field) {
            if (array_key_exists($field, $data) && is_string($data[$field])) {
                $decoded = json_decode($data[$field], true);
                $data[$field] = is_array($decoded) ? $decoded : null;
            }
        }

        if (! empty($gallery)) {
            // Ensure gallery has entries
            if (empty($data['gallery']) || ! is_array($data['gallery'])) {
                $data['gallery'] = $gallery;
            } else {
                // Merge? Prefer uploaded gallery if present
                $data['gallery'] = array_values($data['gallery']);
            }
            if (empty($data['image_url']) && ! empty($data['gallery'][0])) {
                $data['image_url'] = $data['gallery'][0];
            }
        }

        $destination = DB::transaction(function () use ($request, $data) {
            $destination = new Destination($data);
            $destination->source = 'admin';
            $destination->created_by = $request->user()?->id;
            $destination->save();

            return $destination->fresh();
        });

        $this->clearDestinationCaches();

        return (new DestinationResource($destination))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Display the specified destination (including soft-deleted ones).
     */
    public function show(Destination $destination): DestinationResource
    {
        return new DestinationResource($destination);
    }

    /**
     * Update the specified destination.
     */
    public function update(UpdateDestinationRequest $request, Destination $destination): DestinationResource
    {
        $data = $request->validated();

        // Never accept source/created_by/rating/review_count from request input
        unset($data['source'], $data['created_by'], $data['rating'], $data['review_count']);

        $gallery = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                if (! is_array($file) && $file) {
                    $gallery[] = $this->storeUploadedImage($file, $data['name'] ?? $destination->name);
                }
            }
        }
        unset($data['images'], $data['cover_index']);

        if ($request->hasFile('image')) {
            $imageUrl = $this->storeUploadedImage($request->file('image'), $data['name'] ?? $destination->name);
            $data['image_url'] = $imageUrl;
            if (empty($gallery)) {
                $gallery[] = $imageUrl;
            }
            $this->removeUploadedImage($destination->image_url);
        }
        unset($data['image']);

        // Normalize arrays if they come as JSON strings
        $arrayFields = ['highlights', 'how_to_get_there', 'travel_tips', 'gallery'];
        foreach ($arrayFields as $field) {
            if (array_key_exists($field, $data) && is_string($data[$field])) {
                $decoded = json_decode($data[$field], true);
                $data[$field] = is_array($decoded) ? $decoded : null;
            }
        }

        if (! empty($gallery)) {
            if (empty($data['gallery']) || ! is_array($data['gallery'])) {
                $data['gallery'] = $gallery;
            } else {
                // Append new uploads? Or replace? We'll append uploaded files
                $data['gallery'] = array_values(array_merge($data['gallery'], $gallery));
                // Limit to 8
                if (count($data['gallery']) > 8) {
                    $data['gallery'] = array_slice($data['gallery'], 0, 8);
                }
            }
            if (empty($data['image_url']) && ! empty($data['gallery'][0])) {
                $data['image_url'] = $data['gallery'][0];
            }
        }

        $destination = DB::transaction(function () use ($data, $destination) {
            $destination->fill($data);
            $destination->save();

            return $destination->fresh();
        });

        $this->clearDestinationCaches();

        return new DestinationResource($destination);
    }

    /**
     * Soft delete the specified destination.
     */
    public function destroy(Destination $destination): Response
    {
        $destination->delete();
        $this->clearDestinationCaches()

    /**
     * Restore the specified soft-deleted destination.
     */
    public function restore(Destination $destination): DestinationResource
    {
        $destination->restore();
        $this->clearDestinationCaches();

        return new DestinationResource($destination->fresh());
    }

    /**
     * Permanently delete the specified destination, unless itinerary stops still reference it.
     */
    public function forceDelete(Destination $destination): Response|JsonResponse
    {
        $stopCount = $destination->itineraryItems()->count();

        if ($stopCount > 0) {
            return response()->json([
                'message' => "This destination is still used by {$stopCount} itinerary "
                    .($stopCount === 1 ? 'stop' : 'stops').'. Remove or update those stops before deleting it permanently.',
            ], 422);
        }

        $this->removeUploadedImage($destination->image_url);
        $destination->forceDelete();
        $this->clearDestinationCaches();

        return response()->noContent();
    }

    private function clearDestinationCaches(): void
    {
        try {
            Cache::forget('destinations:index');
            Cache::forget('destinations:map');
        } catch (\Throwable $e) {
            // Ignore cache clearing failures
        }
    }

    /**
     * Store an uploaded image on the public disk and return its web path.
     */
    private function storeUploadedImage(mixed $file, string $destinationName): string
    {
        $slug = Str::slug($destinationName);
        $filename = ($slug !== '' ? $slug : 'destination').'-'.Str::lower(Str::random(8)).'.'.$file->extension();

        return '/storage/'.$file->storeAs('destinations', $filename, 'public');
    }

    /**
     * Remove a previously uploaded image, leaving seeded/static assets untouched.
     */
    private function removeUploadedImage(?string $imageUrl): void
    {
        if ($imageUrl === null || ! is_string($imageUrl)) {
            return;
        }
        if (! str_starts_with($imageUrl, '/storage/destinations/')) {
            return;
        }

        Storage::disk('public')->delete('destinations/'.basename($imageUrl));
    }

    /**
     * Parse a sort expression such as "name" or "-created_at" into an orderBy pair.
     *
     * @return array{string, string}
     */
    private function parseSort(string $sort): array
    {
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');

        if (! in_array($column, self::SORTABLE, true)) {
            return ['name', 'asc'];
        }

        return [$column, $direction];
    }
}
