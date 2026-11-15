<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Itinerary;
use App\Models\TripPhoto;
use App\Models\TripRecap;
use App\Services\RecapPresenter;
use App\Services\TripRecapBuilder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TripRecapController extends Controller
{
    public function __construct(
        private readonly TripRecapBuilder $builder,
        private readonly RecapPresenter $presenter,
    ) {}

    /**
     * The recap for a trip. Members may read; owners may edit the design.
     */
    public function show(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('view', $itinerary);

        $recap = $itinerary->recap;

        if ($recap === null || $recap->stats === null) {
            $recap = $this->builder->build($itinerary);
        }

        return response()->json([
            'data' => $this->presenter->member($recap, $request->user()),
        ]);
    }

    /**
     * Update the recap design. The trip itself stays read-only after finish.
     */
    public function update(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('manageRecap', $itinerary);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'visibility' => ['sometimes', Rule::in(TripRecap::VISIBILITIES)],
            'hide_endpoints' => ['sometimes', 'boolean'],
            'show_stats' => ['sometimes', 'boolean'],
            'show_photos' => ['sometimes', 'boolean'],
            'theme_accent' => ['sometimes', Rule::in(TripRecap::ACCENTS)],
            'cover_photo_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        if (array_key_exists('cover_photo_id', $validated) && $validated['cover_photo_id'] !== null) {
            $belongs = TripPhoto::query()
                ->where('itinerary_id', $itinerary->id)
                ->whereKey($validated['cover_photo_id'])
                ->exists();

            if (! $belongs) {
                return response()->json([
                    'message' => 'The cover photo must belong to this trip.',
                    'errors' => ['cover_photo_id' => ['The cover photo must belong to this trip.']],
                ], 422);
            }
        }

        $recap = $this->builder->ensure($itinerary);
        $recap->fill($validated)->save();

        return response()->json([
            'data' => $this->presenter->member($recap->refresh(), $request->user()),
        ]);
    }

    /**
     * Create or replace the public link. The raw token is shown exactly once;
     * only its SHA-256 hash is stored.
     */
    public function shareLink(Request $request, Itinerary $itinerary): JsonResponse
    {
        Gate::authorize('manageRecap', $itinerary);

        $validated = $request->validate([
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('lakbai.recap.max_share_days', 365)],
        ]);

        $days = (int) ($validated['expires_in_days'] ?? config('lakbai.recap.share_days', 30));
        $token = Str::random(64);

        $recap = $this->builder->ensure($itinerary);

        // A token is useless under "private" or "members", so creating a link
        // promotes the recap to link visibility unless it is already public.
        $visibility = $recap->visibility === TripRecap::VISIBILITY_PUBLIC
            ? TripRecap::VISIBILITY_PUBLIC
            : TripRecap::VISIBILITY_LINK;

        $recap->forceFill([
            'share_token_hash' => hash('sha256', $token),
            'share_expires_at' => now()->addDays($days),
            'visibility' => $visibility,
        ])->save();

        $url = rtrim((string) config('lakbai.recap.public_base_url'), '/').'/s/'.$token;

        return response()->json([
            'data' => [
                'token' => $token,
                'url' => $url,
                'expires_at' => $recap->share_expires_at?->toIso8601String(),
                'visibility' => $recap->visibility,
            ],
        ], 201);
    }

    /**
     * Revoke the public link. Existing copies stop resolving immediately.
     */
    public function revokeShareLink(Itinerary $itinerary): Response
    {
        Gate::authorize('manageRecap', $itinerary);

        $recap = $this->builder->ensure($itinerary);

        $recap->forceFill([
            'share_token_hash' => null,
            'share_expires_at' => null,
            'visibility' => TripRecap::VISIBILITY_PRIVATE,
        ])->save();

        return response()->noContent();
    }

    /**
     * PDF recap download, reusing the existing Dompdf dependency and export
     * throttle. Members may download. Budget fields stay subject to the same
     * viewer rules as the API.
     */
    public function export(Request $request, Itinerary $itinerary): SymfonyResponse
    {
        Gate::authorize('export', $itinerary);

        $recap = $itinerary->recap;

        if ($recap === null || $recap->stats === null) {
            $recap = $this->builder->build($itinerary);
        }

        $payload = $this->presenter->member($recap, $request->user());

        $filename = (Str::slug((string) $recap->title) ?: 'trip-recap').'-recap.pdf';

        return Pdf::loadView('exports.recap', ['recap' => $payload])
            ->setPaper('a4')
            ->download($filename);
    }
}
