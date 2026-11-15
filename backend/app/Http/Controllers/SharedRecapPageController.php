<?php

namespace App\Http\Controllers;

use App\Models\TripRecap;
use App\Services\RecapPresenter;
use Illuminate\Http\Response;

/**
 * Server-rendered landing page for `/s/{token}`.
 *
 * Crawlers (and chat apps) get real Open Graph tags; a browser is immediately
 * forwarded to the SPA route that renders the interactive recap. Neither path
 * exposes anything beyond the public whitelist.
 */
class SharedRecapPageController extends Controller
{
    public function __construct(private readonly RecapPresenter $presenter) {}

    public function show(string $token): Response
    {
        $recap = TripRecap::findByShareToken($token);

        $appUrl = rtrim((string) config('lakbai.recap.app_url'), '/').'/s/'.$token;
        $publicUrl = rtrim((string) config('lakbai.recap.public_base_url'), '/').'/s/'.$token;

        if ($recap === null || ! $recap->isPubliclyVisible()) {
            return response()
                ->view('shared.recap-invalid', [
                    'appUrl' => $appUrl,
                    'publicUrl' => $publicUrl,
                ], 404)
                ->header('X-Robots-Tag', 'noindex, nofollow');
        }

        $payload = $this->presenter->public($recap);

        return response()->view('shared.recap', [
            'recap' => $payload,
            'appUrl' => $appUrl,
            'publicUrl' => $publicUrl,
        ]);
    }
}
