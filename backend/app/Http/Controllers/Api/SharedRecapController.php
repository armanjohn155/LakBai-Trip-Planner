<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TripRecap;
use App\Services\RecapPresenter;
use Illuminate\Http\JsonResponse;

class SharedRecapController extends Controller
{
    public function __construct(private readonly RecapPresenter $presenter) {}

    /**
     * Public, unauthenticated recap. Invalid, expired and revoked tokens are
     * indistinguishable from one another so a link cannot be probed.
     */
    public function show(string $token): JsonResponse
    {
        $recap = TripRecap::findByShareToken($token);

        if ($recap === null || ! $recap->isPubliclyVisible()) {
            return response()->json([
                'message' => 'This recap link is invalid or has expired.',
            ], 404);
        }

        return response()->json([
            'data' => $this->presenter->public($recap),
        ]);
    }
}
