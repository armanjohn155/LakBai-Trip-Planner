<?php

namespace App\Http\Controllers\Api\Admin;

use App\Events\ReviewHidden;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

class ReviewController extends Controller
{
    /**
     * Paginated moderation queue of reviews, including hidden ones.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('moderate', Review::class);

        $status = $request->string('status')->toString();

        $reviews = Review::query()
            ->with(['user', 'destination', 'photos'])
            ->withCount('reports')
            ->when($status === 'hidden', fn (Builder $query) => $query->where('is_hidden', true))
            ->when($status === 'visible', fn (Builder $query) => $query->where('is_hidden', false))
            ->when($status === 'reported', fn (Builder $query) => $query->has('reports'))
            ->when($request->filled('search'), function (Builder $query) use ($request) {
                $search = $request->string('search')->toString();

                $query->where(function (Builder $inner) use ($search) {
                    $connection = $inner->getConnection()->getDriverName();
                    if ($connection === 'pgsql') {
                        $inner->where('title', 'ilike', "%{$search}%")
                            ->orWhere('body', 'ilike', "%{$search}%");
                    } else {
                        $inner->where('title', 'like', "%{$search}%")
                            ->orWhere('body', 'like', "%{$search}%");
                    }
                });
            })
            ->when($request->filled('destination_id'), fn (Builder $query) => $query->where('destination_id', $request->integer('destination_id')))
            ->orderByDesc('reports_count')
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return ReviewResource::collection($reviews);
    }

    /**
     * Hide a review from public listings.
     */
    public function hide(Request $request, Review $review): JsonResponse
    {
        Gate::authorize('moderate', $review);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $wasHidden = (bool) $review->is_hidden;

        $review->forceFill([
            'is_hidden' => true,
            'hidden_reason' => $validated['reason'] ?? 'Hidden by moderator.',
            'hidden_by' => $request->user()->id,
        ])->save();

        if (! $wasHidden) {
            event(new ReviewHidden($review, $request->user(), $review->hidden_reason));
        }

        return (new ReviewResource($review->load(['user', 'destination', 'photos'])))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * Restore a hidden review to public listings.
     */
    public function unhide(Request $request, Review $review): JsonResponse
    {
        Gate::authorize('moderate', $review);

        $review->forceFill([
            'is_hidden' => false,
            'hidden_reason' => null,
            'hidden_by' => null,
        ])->save();

        return (new ReviewResource($review->load(['user', 'destination', 'photos'])))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * Permanently remove any review (moderation).
     */
    public function destroy(Review $review): Response
    {
        Gate::authorize('moderate', $review);

        foreach ($review->photos as $photo) {
            Storage::disk('public')->delete($photo->path);
        }

        $review->forceDelete();

        return response()->noContent();
    }
}
