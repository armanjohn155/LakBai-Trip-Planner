<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreDestinationRequest;
use App\Http\Requests\Admin\UpdateDestinationRequest;
use App\Http\Resources\DestinationResource;
use App\Models\Destination;
use App\Services\DestinationOptionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

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
        try {
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
        } catch (Throwable $e) {
            $handled = $this->respondToPersistenceFailure($e, 'store', null);
            if ($handled !== null) {
                return $handled;
            }

            Log::error('Failed to create destination.', [
                'action' => 'store',
                'admin_id' => $request->user()?->id,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
            report($e);

            return response()->json([
                'message' => 'Failed to create destination.',
            ], 500);
        }
    }

    /**
     * Display the specified destination (including soft-deleted ones).
     */
    public function show(Destination $destination): DestinationResource
    {
        return new DestinationResource($destination);
    }

    /**
     * Confirm a destination row is persisted in the active database.
     */
    public function dbCheck(Destination $destination): JsonResponse
    {
        $fresh = Destination::withTrashed()->findOrFail($destination->getKey());
        $connection = DB::connection();

        return response()->json([
            'saved_to_database' => true,
            'id' => $fresh->id,
            'created_at' => $fresh->created_at?->toAtomString(),
            'source' => $fresh->source,
            'database_name' => $connection->getDatabaseName(),
            'database_driver' => $connection->getDriverName(),
        ]);
    }

    /**
     * Update the specified destination.
     */
    public function update(UpdateDestinationRequest $request, Destination $destination): DestinationResource|JsonResponse
    {
        try {
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
                    $data['gallery'] = array_values(array_merge($data['gallery'], $gallery));
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
        } catch (Throwable $e) {
            $handled = $this->respondToPersistenceFailure($e, 'update', $destination->id);
            if ($handled !== null) {
                return $handled;
            }

            Log::error('Failed to update destination.', [
                'action' => 'update',
                'destination_id' => $destination->id,
                'admin_id' => $request->user()?->id,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
            report($e);

            return response()->json([
                'message' => 'Failed to update destination.',
            ], 500);
        }
    }

    /**
     * Soft delete the specified destination.
     */
    public function destroy(Destination $destination): Response
    {
        $destination->delete();
        $this->clearDestinationCaches();

        return response()->noContent();
    }

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
        } catch (Throwable $e) {
            // Ignore cache clearing failures
        }

        try {
            app(DestinationOptionService::class)->forget();
        } catch (Throwable $e) {
            // Ignore cache clearing failures
        }
    }

    /**
     * Convert obvious database/input failures into validation-style 422 responses.
     */
    private function respondToPersistenceFailure(Throwable $e, string $action, ?int $destinationId): ?JsonResponse
    {
        $isQueryFailure = $e instanceof QueryException || $e->getPrevious() instanceof QueryException;
        if (! $isQueryFailure) {
            return null;
        }

        $message = $e->getMessage();

        if (str_contains($message, 'destinations_name_unique')
            || str_contains($message, 'destinations.name')
            || str_contains($message, 'UNIQUE constraint failed: destinations.name')) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'name' => ['A destination with this name already exists.'],
                ],
            ], 422);
        }

        if (str_contains($message, 'value too long')
            || str_contains($message, 'Data too long')
            || str_contains($message, 'String data, right truncated')) {
            return response()->json([
                'message' => 'One or more fields are too long. Please shorten the input and try again.',
                'errors' => [
                    'name' => ['One or more fields are too long. Please shorten the input and try again.'],
                ],
            ], 422);
        }

        Log::warning('Destination persistence rejected by the database.', [
            'action' => $action,
            'destination_id' => $destinationId,
            'exception' => $e::class,
            'message' => $e->getMessage(),
        ]);

        return response()->json([
            'message' => 'The destination could not be saved because some values are invalid. Please review the form and try again.',
        ], 422);
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
