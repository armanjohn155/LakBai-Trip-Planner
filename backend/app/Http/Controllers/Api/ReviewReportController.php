<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportReviewRequest;
use App\Models\Review;
use App\Models\ReviewReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ReviewReportController extends Controller
{
    /**
     * Report a review for moderation.
     */
    public function store(ReportReviewRequest $request, Review $review): JsonResponse
    {
        Gate::authorize('report', $review);

        ReviewReport::create([
            'review_id' => $review->id,
            'user_id' => $request->user()->id,
            'reason' => $request->string('reason')->toString(),
            'details' => $request->input('details'),
        ]);

        return response()->json([
            'message' => 'Thank you. Our moderators will review this content.',
        ], 201);
    }
}
