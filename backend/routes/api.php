<?php

use App\Http\Controllers\Api\Admin\DestinationController as AdminDestinationController;
use App\Http\Controllers\Api\Admin\ItineraryTemplateController as AdminItineraryTemplateController;
use App\Http\Controllers\Api\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DestinationController;
use App\Http\Controllers\Api\FavoritesController;
use App\Http\Controllers\Api\ItineraryController;
use App\Http\Controllers\Api\ItineraryExportController;
use App\Http\Controllers\Api\ItineraryItemController;
use App\Http\Controllers\Api\ItineraryRouteEstimateController;
use App\Http\Controllers\Api\ItineraryTemplateController;
use App\Http\Controllers\Api\MyReviewController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ReviewReportController;
use App\Http\Controllers\Api\VisitController;
use App\Http\Controllers\Api\VisitHistoryController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/destinations', [DestinationController::class, 'index']);
Route::get('/destinations/{destination}', [DestinationController::class, 'show']);

// Public review listing; auth (when present) unlocks "can" flags and admin visibility.
Route::get('/destinations/{destination}/reviews', [ReviewController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user', [ProfileController::class, 'update']);
    Route::post('/user/avatar', [ProfileController::class, 'avatar']);
    Route::post('/user/password', [ProfileController::class, 'password']);
    Route::delete('/user', [ProfileController::class, 'destroy']);
    Route::get('/user/settings', [ProfileController::class, 'settings']);
    Route::put('/user/settings', [ProfileController::class, 'updateSettings']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/itineraries', [ItineraryController::class, 'index']);
    Route::post('/itineraries', [ItineraryController::class, 'store']);
    Route::get('/itineraries/{itinerary}', [ItineraryController::class, 'show']);
    Route::put('/itineraries/{itinerary}', [ItineraryController::class, 'update']);
    Route::delete('/itineraries/{itinerary}', [ItineraryController::class, 'destroy']);
    Route::get('/itineraries/{itinerary}/summary', [ItineraryController::class, 'summary']);
    Route::post('/itineraries/{itinerary}/duplicate', [ItineraryController::class, 'duplicate']);
    Route::get('/itineraries/{itinerary}/route-estimates', [ItineraryRouteEstimateController::class, 'show']);
    Route::get('/itineraries/{itinerary}/export', [ItineraryExportController::class, 'export'])
        ->middleware('throttle:'.config('lakbai.export.throttle', '20,1'));

    Route::post('/itineraries/{itinerary}/items', [ItineraryItemController::class, 'store']);
    Route::put('/itineraries/{itinerary}/items/reorder', [ItineraryItemController::class, 'reorder']);
    Route::put('/itineraries/{itinerary}/items/{item}', [ItineraryItemController::class, 'update'])
        ->scopeBindings();
    Route::delete('/itineraries/{itinerary}/items/{item}', [ItineraryItemController::class, 'destroy'])
        ->scopeBindings();

    // Admin-curated itinerary templates (usable by any authenticated user).
    Route::get('/itinerary-templates', [ItineraryTemplateController::class, 'index']);
    Route::post('/itinerary-templates/{template}/use', [ItineraryTemplateController::class, 'use']);

    Route::get('/favorites', [FavoritesController::class, 'index']);
    Route::post('/favorites/{destination}', [FavoritesController::class, 'store']);
    Route::delete('/favorites/{destination}', [FavoritesController::class, 'destroy']);

    // Visits: honest, GPS-verified (or manual) check-ins.
    Route::get('/visits', [VisitHistoryController::class, 'index']);
    Route::get('/visits/stats', [VisitHistoryController::class, 'stats']);
    Route::get('/visits/map', [VisitHistoryController::class, 'map']);
    Route::delete('/visits/{visit}', [VisitController::class, 'destroy']);
    Route::post('/destinations/{destination}/check-in', [VisitController::class, 'checkIn'])
        ->middleware('throttle:10,1');
    Route::post('/destinations/{destination}/visits/manual', [VisitController::class, 'manual']);

    // Reviews authored by the current user (includes pending/hidden ones).
    Route::get('/reviews/mine', [MyReviewController::class, 'index']);
    Route::post('/destinations/{destination}/reviews', [ReviewController::class, 'store']);
    Route::match(['put', 'patch'], '/reviews/{review}', [ReviewController::class, 'update']);
    Route::delete('/reviews/{review}', [ReviewController::class, 'destroy']);
    Route::post('/reviews/{review}/report', [ReviewReportController::class, 'store']);
});

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/destinations', [AdminDestinationController::class, 'index']);
    Route::post('/destinations', [AdminDestinationController::class, 'store']);
    Route::get('/destinations/{destination}', [AdminDestinationController::class, 'show'])->withTrashed();
    Route::match(['put', 'patch'], '/destinations/{destination}', [AdminDestinationController::class, 'update'])->withTrashed();
    Route::delete('/destinations/{destination}', [AdminDestinationController::class, 'destroy'])->withTrashed();
    Route::post('/destinations/{destination}/restore', [AdminDestinationController::class, 'restore'])->withTrashed();
    Route::delete('/destinations/{destination}/force', [AdminDestinationController::class, 'forceDelete'])->withTrashed();

    // Review moderation.
    Route::get('/reviews', [AdminReviewController::class, 'index']);
    Route::post('/reviews/{review}/hide', [AdminReviewController::class, 'hide'])->withTrashed();
    Route::post('/reviews/{review}/unhide', [AdminReviewController::class, 'unhide'])->withTrashed();
    Route::delete('/reviews/{review}', [AdminReviewController::class, 'destroy'])->withTrashed();

    // Curate public itinerary templates from any itinerary.
    Route::post('/itineraries/{itinerary}/template', [AdminItineraryTemplateController::class, 'store']);
    Route::delete('/itineraries/{itinerary}/template', [AdminItineraryTemplateController::class, 'destroy']);
});
