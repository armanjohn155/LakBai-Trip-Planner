<?php

use App\Http\Controllers\Api\Admin\DestinationController as AdminDestinationController;
use App\Http\Controllers\Api\Admin\DestinationOptionController as AdminDestinationOptionController;
use App\Http\Controllers\Api\Admin\ItineraryTemplateController as AdminItineraryTemplateController;
use App\Http\Controllers\Api\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DestinationController;
use App\Http\Controllers\Api\DestinationOptionController;
use App\Http\Controllers\Api\FavoritesController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\GoogleAuthController;
use App\Http\Controllers\Api\GroupTrackingController;
use App\Http\Controllers\Api\InviteLinkController;
use App\Http\Controllers\Api\ItineraryActivityController;
use App\Http\Controllers\Api\ItineraryController;
use App\Http\Controllers\Api\ItineraryExportController;
use App\Http\Controllers\Api\ItineraryInviteAcceptController;
use App\Http\Controllers\Api\ItineraryInviteController;
use App\Http\Controllers\Api\ItineraryItemController;
use App\Http\Controllers\Api\ItineraryMemberController;
use App\Http\Controllers\Api\ItineraryOwnershipController;
use App\Http\Controllers\Api\ItineraryRouteEstimateController;
use App\Http\Controllers\Api\ItineraryTemplateController;
use App\Http\Controllers\Api\MyReviewController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ReviewReportController;
use App\Http\Controllers\Api\RouteController;
use App\Http\Controllers\Api\SharedRecapController;
use App\Http\Controllers\Api\TripPhotoController;
use App\Http\Controllers\Api\TripRecapController;
use App\Http\Controllers\Api\TripStopController;
use App\Http\Controllers\Api\TripTrackingController;
use App\Http\Controllers\Api\VisitController;
use App\Http\Controllers\Api\VisitHistoryController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Google OAuth 2.0
Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect']);
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback']);

Route::get('/destinations', [DestinationController::class, 'index']);
Route::get('/destinations/{destination}', [DestinationController::class, 'show']);

// Public category/region option lists for filters, chips, and comboboxes.
Route::get('/destination-options', [DestinationOptionController::class, 'index']);

// Public review listing; auth (when present) unlocks "can" flags and admin visibility.
Route::get('/destinations/{destination}/reviews', [ReviewController::class, 'index']);

// Road geometry contains no user-specific data and is used by the public map.
Route::post('/routes', [RouteController::class, 'store'])
    ->middleware('throttle:30,1,trip-routes');

// Public trip recap. Token-gated, rate-limited, and safe to open without auth.
Route::get('/shared/recaps/{token}', [SharedRecapController::class, 'show'])
    ->middleware('throttle:'.config('lakbai.recap.public_throttle', '30,1').',shared-recap');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user', [ProfileController::class, 'update']);
    Route::post('/user/avatar', [ProfileController::class, 'avatar']);
    Route::post('/user/password', [ProfileController::class, 'password']);
    Route::delete('/user', [ProfileController::class, 'destroy']);
    Route::get('/user/settings', [ProfileController::class, 'settings']);
    Route::put('/user/settings', [ProfileController::class, 'updateSettings']);
    Route::post('/logout', [AuthController::class, 'logout']);
    // Friends
    Route::middleware('throttle:'.config('lakbai.friends.read_throttle', '60,1').',friend-read')->group(function () {
        Route::get('/friends', [FriendController::class, 'index']);
        Route::get('/friends/requests', [FriendController::class, 'requests']);
        Route::post('/friends/requests', [FriendController::class, 'send'])->middleware('throttle:'.config('lakbai.friends.request_throttle', '15,1').',friend-request');
        Route::post('/friends/requests/{friendship}/accept', [FriendController::class, 'accept']);
        Route::post('/friends/requests/{friendship}/decline', [FriendController::class, 'decline']);
        Route::delete('/friends/requests/{friendship}', [FriendController::class, 'cancel']);
        Route::delete('/friends/{user}', [FriendController::class, 'unfriend']);
        Route::post('/blocks/{user}', [FriendController::class, 'block']);
        Route::delete('/blocks/{user}', [FriendController::class, 'unblock']);
        Route::get('/blocks', [FriendController::class, 'blocked']);
        Route::get('/me/friend-code', [FriendController::class, 'friendCode']);
        Route::post('/me/friend-code/regenerate', [FriendController::class, 'regenerateFriendCode'])
            ->middleware('throttle:'.config('lakbai.friends.friend_code_regen_throttle', '5,1').',friend-code-regen');
    });

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::delete('/notifications/read', [NotificationController::class, 'clearRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'read']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);
    Route::get('/notification-preferences', [NotificationPreferenceController::class, 'index']);
    Route::put('/notification-preferences', [NotificationPreferenceController::class, 'update']);

    Route::get('/itineraries', [ItineraryController::class, 'index']);
    Route::post('/itineraries', [ItineraryController::class, 'store']);
    Route::get('/itineraries/{itinerary}', [ItineraryController::class, 'show']);
    Route::put('/itineraries/{itinerary}', [ItineraryController::class, 'update']);
    Route::delete('/itineraries/{itinerary}', [ItineraryController::class, 'destroy']);
    Route::get('/itineraries/{itinerary}/summary', [ItineraryController::class, 'summary']);
    Route::get('/itineraries/{itinerary}/changes', [ItineraryController::class, 'changes']);
    Route::get('/itineraries/{itinerary}/activities', [ItineraryActivityController::class, 'index']);
    Route::post('/itineraries/{itinerary}/duplicate', [ItineraryController::class, 'duplicate']);
    Route::get('/itineraries/{itinerary}/route-estimates', [ItineraryRouteEstimateController::class, 'show']);
    Route::get('/itineraries/{itinerary}/export', [ItineraryExportController::class, 'export'])
        ->middleware('throttle:'.config('lakbai.export.throttle', '20,1').',itinerary-export');

    // Completed-trip recap: memorable design, photos and a revocable public link.
    Route::get('/itineraries/{itinerary}/recap', [TripRecapController::class, 'show']);
    Route::put('/itineraries/{itinerary}/recap', [TripRecapController::class, 'update']);
    Route::post('/itineraries/{itinerary}/recap/share-link', [TripRecapController::class, 'shareLink'])
        ->middleware('throttle:'.config('lakbai.recap.share_throttle', '10,1').',recap-share');
    Route::delete('/itineraries/{itinerary}/recap/share-link', [TripRecapController::class, 'revokeShareLink'])
        ->middleware('throttle:'.config('lakbai.recap.share_throttle', '10,1').',recap-share');
    Route::get('/itineraries/{itinerary}/recap/export', [TripRecapController::class, 'export'])
        ->middleware('throttle:'.config('lakbai.export.throttle', '20,1').',itinerary-export');

    Route::get('/itineraries/{itinerary}/photos', [TripPhotoController::class, 'index']);
    Route::post('/itineraries/{itinerary}/photos', [TripPhotoController::class, 'store'])
        ->middleware('throttle:'.config('lakbai.recap.upload_throttle', '30,1').',recap-photo-upload');
    Route::put('/itineraries/{itinerary}/photos/reorder', [TripPhotoController::class, 'reorder']);
    Route::match(['put', 'patch'], '/itineraries/{itinerary}/photos/{photo}', [TripPhotoController::class, 'update'])
        ->scopeBindings();
    Route::delete('/itineraries/{itinerary}/photos/{photo}', [TripPhotoController::class, 'destroy'])
        ->scopeBindings();

    // Sharing
    Route::get('/itineraries/{itinerary}/members', [ItineraryMemberController::class, 'index']);
    Route::post('/itineraries/{itinerary}/members', [ItineraryMemberController::class, 'store'])
        ->middleware('throttle:'.config('lakbai.sharing.invite_throttle', '20,1').',trip-member-invite');
    Route::patch('/itineraries/{itinerary}/members/{user}', [ItineraryMemberController::class, 'update']);
    Route::delete('/itineraries/{itinerary}/members/{user}', [ItineraryMemberController::class, 'destroy']);
    Route::get('/itineraries/{itinerary}/invitation', [ItineraryMemberController::class, 'invitation']);
    Route::post('/itineraries/{itinerary}/invitation/accept', [ItineraryMemberController::class, 'accept']);
    Route::post('/itineraries/{itinerary}/invitation/decline', [ItineraryMemberController::class, 'decline']);
    Route::patch('/itineraries/{itinerary}/rsvp', [ItineraryMemberController::class, 'rsvp']);
    Route::post('/itineraries/{itinerary}/transfer-ownership', [ItineraryOwnershipController::class, 'transfer']);

    // Share links (link fallback for invitees who are not yet friends)
    Route::get('/itineraries/{itinerary}/invite-links', [InviteLinkController::class, 'index']);
    Route::post('/itineraries/{itinerary}/invite-links', [InviteLinkController::class, 'store'])
        ->middleware('throttle:'.config('lakbai.sharing.invite_throttle', '20,1').',invite-link-create');
    Route::delete('/itineraries/{itinerary}/invite-links/{invite}', [InviteLinkController::class, 'destroy']);
    Route::get('/invite-links/{token}', [InviteLinkController::class, 'show']);
    Route::post('/invite-links/{token}/accept', [InviteLinkController::class, 'accept'])
        ->middleware('throttle:'.config('lakbai.sharing.invite_accept_throttle', '10,1').',invite-link-accept');

    // Legacy email/link invite endpoints (kept for backwards compatibility).
    Route::get('/itineraries/{itinerary}/invites', [ItineraryInviteController::class, 'index']);
    Route::post('/itineraries/{itinerary}/invites', [ItineraryInviteController::class, 'store'])
        ->middleware('throttle:'.config('lakbai.sharing.invite_throttle', '20,1').',itinerary-invite-create');
    Route::delete('/itineraries/{itinerary}/invites/{invite}', [ItineraryInviteController::class, 'destroy']);

    Route::post('/itineraries/{itinerary}/items', [ItineraryItemController::class, 'store']);
    Route::put('/itineraries/{itinerary}/items/reorder', [ItineraryItemController::class, 'reorder']);
    Route::put('/itineraries/{itinerary}/items/{item}', [ItineraryItemController::class, 'update'])
        ->scopeBindings();
    Route::delete('/itineraries/{itinerary}/items/{item}', [ItineraryItemController::class, 'destroy'])
        ->scopeBindings();

    // Solo live trip lifecycle and GPS tracking. All thresholds live in
    // config/lakbai.php under "tracking"; the client never decides validity.
    Route::get('/itineraries/{itinerary}/tracking', [TripTrackingController::class, 'show'])
        ->middleware('throttle:60,1');
    Route::post('/itineraries/{itinerary}/tracking/points', [TripTrackingController::class, 'points'])
        ->middleware('throttle:'.config('lakbai.tracking.points_throttle', '30,1').',trip-tracking-points');

    // Group live tracking. Sharing is opt-in per traveller; reads are scoped to
    // accepted members and only reveal positions to members who also share.
    Route::get('/itineraries/{itinerary}/tracking/group', [GroupTrackingController::class, 'show'])
        ->middleware('throttle:'.config('lakbai.tracking.group_read_throttle', '120,1').',trip-group-read');
    Route::patch('/itineraries/{itinerary}/tracking/sharing', [GroupTrackingController::class, 'sharing'])
        ->middleware('throttle:'.config('lakbai.tracking.group_write_throttle', '30,1').',trip-group-write');
    Route::post('/itineraries/{itinerary}/tracking/meetup', [GroupTrackingController::class, 'meetup'])
        ->middleware('throttle:'.config('lakbai.tracking.group_write_throttle', '30,1').',trip-group-write');

    Route::post('/itineraries/{itinerary}/tracking/{action}', [TripTrackingController::class, 'transition'])
        ->whereIn('action', ['start', 'pause', 'resume', 'stop'])
        ->middleware('throttle:60,1');
    Route::post('/itineraries/{itinerary}/lifecycle/reschedule', [TripTrackingController::class, 'reschedule'])
        ->middleware('throttle:60,1');
    Route::post('/itineraries/{itinerary}/lifecycle/cancel', [TripTrackingController::class, 'cancel'])
        ->middleware('throttle:60,1');
    Route::post('/itineraries/{itinerary}/stops/{item}/arrive', [TripStopController::class, 'arrive'])
        ->scopeBindings();
    Route::post('/itineraries/{itinerary}/stops/{item}/complete', [TripStopController::class, 'complete'])
        ->scopeBindings();
    Route::post('/itineraries/{itinerary}/stops/{item}/skip', [TripStopController::class, 'skip'])
        ->scopeBindings();
    Route::post('/itineraries/{itinerary}/stops/{item}/undo', [TripStopController::class, 'undo'])
        ->scopeBindings();

    // Accept invite (auth required)
    Route::get('/invites/{token}', [ItineraryInviteAcceptController::class, 'show']);
    Route::post('/invites/{token}/accept', [ItineraryInviteAcceptController::class, 'accept'])
        ->middleware('throttle:'.config('lakbai.sharing.invite_accept_throttle', '10,1').',itinerary-invite-accept');

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
    Route::get('/destinations/{destination}/db-check', [AdminDestinationController::class, 'dbCheck'])->withTrashed();
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

    // Admin-managed destination category and region options.
    Route::middleware('throttle:60,1,admin-destination-options')->group(function () {
        Route::get('/categories', [AdminDestinationOptionController::class, 'categories']);
        Route::post('/categories', [AdminDestinationOptionController::class, 'storeCategory']);
        Route::put('/categories/reorder', [AdminDestinationOptionController::class, 'reorderCategories']);
        Route::match(['put', 'patch'], '/categories/{category}', [AdminDestinationOptionController::class, 'updateCategory']);
        Route::delete('/categories/{category}', [AdminDestinationOptionController::class, 'destroyCategory']);

        Route::get('/regions', [AdminDestinationOptionController::class, 'regions']);
        Route::post('/regions', [AdminDestinationOptionController::class, 'storeRegion']);
        Route::put('/regions/reorder', [AdminDestinationOptionController::class, 'reorderRegions']);
        Route::match(['put', 'patch'], '/regions/{region}', [AdminDestinationOptionController::class, 'updateRegion']);
        Route::delete('/regions/{region}', [AdminDestinationOptionController::class, 'destroyRegion']);
    });
});
