<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReviewRequest;
use App\Http\Requests\UpdateReviewRequest;
use App\Http\Resources\ReviewResource;
use App\Models\Destination;
use App\Models\Review;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReviewController extends Controller
{
    /**
     * Public, paginated reviews for a destination.
     */
    public function index(Request $request, Destination $destination): AnonymousResourceCollection
    {
        $user = $request->user();

        $reviews = Review::query()
            ->where('destination_id', $destination->id)
            ->when(! $user?->isAdmin(), fn ($query) => $query->visible())
            ->with(['user', 'photos'])
            ->when($request->filled('rating'), fn ($query) => $query->where('rating', $request->integer('rating')))
            ->when($request->filled('sort'), function ($query) use ($request) {
                match ($request->string('sort')->toString()) {
                    'highest' => $query->orderByDesc('rating'),
                    'lowest' => $query->orderBy('rating'),
                    'oldest' => $query->oldest(),
                    default => $query->latest(),
                };
            }, fn ($query) => $query->latest())
            ->paginate($request->integer('per_page', 10));

        return ReviewResource::collection($reviews);
    }

    /**
     * Create the authenticated user's review for a destination they have visited.
     */
    public function store(StoreReviewRequest $request, Destination $destination): JsonResponse
    {
        if ($destination->trashed()) {
            throw ValidationException::withMessages([
                'destination' => 'This destination is no longer available.',
            ]);
        }

        Gate::authorize('create', Review::class);

        $visit = $this->qualifyingVisit($request, $destination);

        if ($visit === null) {
            throw ValidationException::withMessages([
                'destination' => 'You can only review destinations you have visited. Check in with GPS to unlock reviews.',
            ]);
        }

        $existing = Review::withTrashed()
            ->where('user_id', $request->user()->id)
            ->where('destination_id', $destination->id)
            ->first();

        if ($existing !== null) {
            // A soft-deleted review can be revived by resubmitting.
            if ($existing->trashed()) {
                $existing->restore();
                $existing->fill($this->reviewData($request));
                $existing->edited_at = now();
                $existing->is_hidden = false;
                $existing->hidden_reason = null;
                $existing->save();
            } else {
                $existing->fill($this->reviewData($request));
                $existing->edited_at = now();
                $existing->is_hidden = false;
                $existing->hidden_reason = null;
                $existing->save();
            }

            $this->syncPhotos($existing, $request, []);

            return (new ReviewResource($existing->load(['user', 'photos'])))
                ->response()
                ->setStatusCode(200);
        }

        $review = Review::create([
            ...$this->reviewData($request),
            'user_id' => $request->user()->id,
            'destination_id' => $destination->id,
            'visit_id' => $visit->id,
            'is_hidden' => $this->isFlagged($request),
            'hidden_reason' => $this->isFlagged($request) ? 'Matched the word filter.' : null,
        ]);

        $this->syncPhotos($review, $request, []);

        return (new ReviewResource($review->load(['user', 'photos'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * The accepted visit that unlocks reviewing this destination.
     */
    private function qualifyingVisit(Request $request, Destination $destination): ?Visit
    {
        return Visit::query()
            ->forUser($request->user())
            ->where('destination_id', $destination->id)
            ->verified()
            ->latest('visited_at')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function reviewData(StoreReviewRequest|UpdateReviewRequest $request): array
    {
        $data = $request->safe()->only(['rating', 'title', 'body', 'visited_on']);

        if (array_key_exists('body', $data) && is_string($data['body'])) {
            $data['body'] = $this->sanitize($data['body']);
        }

        if (array_key_exists('title', $data) && is_string($data['title'])) {
            $data['title'] = $this->sanitize($data['title']);
        }

        return $data;
    }

    /**
     * Strip all HTML tags; reviews are stored and rendered as plain text.
     */
    private function sanitize(string $value): string
    {
        return trim(strip_tags($value));
    }

    /**
     * Whether the submitted content should be hidden pending moderation.
     */
    private function isFlagged(Request $request): bool
    {
        $words = array_filter((array) config('lakbai.banned_words', []));

        if ($words === []) {
            return false;
        }

        $haystack = Str::lower(($request->input('title') ?? '').' '.($request->input('body') ?? ''));

        foreach ($words as $word) {
            if ($word !== '' && str_contains($haystack, Str::lower((string) $word))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Persist uploaded photos, removing any explicitly requested ones first.
     *
     * @param  array<int, int>  $removeIds
     */
    private function syncPhotos(Review $review, Request $request, array $removeIds): void
    {
        foreach ($review->photos()->whereIn('id', $removeIds)->get() as $photo) {
            Storage::disk('public')->delete($photo->path);
            $photo->delete();
        }

        $remaining = $review->photos()->count();
        $budget = Review::MAX_PHOTOS - $remaining;

        if ($budget <= 0) {
            return;
        }

        foreach (array_slice($request->file('photos', []) ?? [], 0, $budget) as $file) {
            $filename = Str::uuid()->toString().'.'.$file->extension();
            $path = $file->storeAs('reviews', $filename, 'public');
            $review->photos()->create(['path' => $path]);
        }
    }

    /**
     * Update the authenticated author's own review.
     */
    public function update(UpdateReviewRequest $request, Review $review): JsonResponse
    {
        $review->fill($this->reviewData($request));
        $review->edited_at = now();
        $review->is_hidden = $this->isFlagged($request);
        $review->hidden_reason = $review->is_hidden ? 'Matched the word filter.' : null;
        $review->save();

        $this->syncPhotos($review, $request, (array) $request->input('remove_photo_ids', []));

        return (new ReviewResource($review->load(['user', 'photos'])))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * Soft-delete the authenticated author's review.
     */
    public function destroy(Request $request, Review $review): Response
    {
        Gate::authorize('delete', $review);

        $review->delete();

        return response()->noContent();
    }
}
