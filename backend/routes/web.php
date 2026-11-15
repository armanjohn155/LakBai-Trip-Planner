<?php

use App\Http\Controllers\SharedRecapPageController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/*
 * Open Graph landing page for public recaps. Crawlers read the meta tags;
 * browsers are forwarded to the SPA route /s/{token}. The API endpoint it
 * mirrors is /api/shared/recaps/{token}.
 */
Route::get('/s/{token}', [SharedRecapPageController::class, 'show'])
    ->middleware('throttle:'.config('lakbai.recap.meta_throttle', '60,1').',shared-recap-page')
    ->name('shared.recap');
