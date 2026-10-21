<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MyReviewController extends Controller
{
    /**
     * Reviews authored by the authenticated user, including pending ones.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $reviews = Review::query()
            ->forUser($request->user())
            ->with(['destination', 'photos'])
            ->latest()
            ->paginate($request->integer('per_page', 10));

        return ReviewResource::collection($reviews);
    }
}
