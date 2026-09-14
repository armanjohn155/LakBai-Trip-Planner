<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DestinationController;
use App\Http\Controllers\Api\FavoritesController;
use App\Http\Controllers\Api\ItineraryController;
use App\Http\Controllers\Api\ItineraryItemController;
use App\Http\Controllers\Api\ProfileController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/destinations', [DestinationController::class, 'index']);
Route::get('/destinations/{destination}', [DestinationController::class, 'show']);

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

    Route::post('/itineraries/{itinerary}/items', [ItineraryItemController::class, 'store']);
    Route::put('/itineraries/{itinerary}/items/{item}', [ItineraryItemController::class, 'update'])
        ->scopeBindings();
    Route::delete('/itineraries/{itinerary}/items/{item}', [ItineraryItemController::class, 'destroy'])
        ->scopeBindings();

    Route::get('/favorites', [FavoritesController::class, 'index']);
    Route::post('/favorites/{destination}', [FavoritesController::class, 'store']);
    Route::delete('/favorites/{destination}', [FavoritesController::class, 'destroy']);
});
