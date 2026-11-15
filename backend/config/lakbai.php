<?php

return [
    /*
    |--------------------------------------------------------------------------
    | GPS Check-in Verification
    |--------------------------------------------------------------------------
    |
    | These thresholds are enforced server-side by App\Services\CheckInVerifier.
    | The client never decides whether a visit is verified.
    |
    */

    // Reject a reported position whose accuracy radius is worse than this.
    'max_accuracy_m' => env('LAKBAI_CHECKIN_MAX_ACCURACY_M', 100),

    // No second verified check-in for the same user + destination within this window.
    'cooldown_hours' => env('LAKBAI_CHECKIN_COOLDOWN_HOURS', 12),

    // The default allowed check-in radius (meters) for a destination that has none set.
    'default_radius_m' => env('LAKBAI_CHECKIN_DEFAULT_RADIUS_M', 150),

    // Reject a check-in whose implied travel speed from the previous verified
    // visit exceeds this (km/h) — an impossible-travel guard.
    'max_speed_kmh' => env('LAKBAI_CHECKIN_MAX_SPEED_KMH', 900),

    // How many visits the history endpoints return per page.
    'history_per_page' => env('LAKBAI_HISTORY_PER_PAGE', 15),

    /*
    |--------------------------------------------------------------------------
    | Review Moderation
    |--------------------------------------------------------------------------
    */

    // Reviews whose title/body contain any of these words are flagged for
    // moderation (hidden) instead of being rejected. Empty by default.
    'banned_words' => [],

    /*
    |--------------------------------------------------------------------------
    | Itinerary Routing Estimates (optional)
    |--------------------------------------------------------------------------
    |
    | Travel-time estimates between consecutive stops are DEACTIVATED by
    | default. When enabled, the RouteEstimator queries an OSRM server for
    | road distance/duration and falls back to a straight-line (Haversine)
    | estimate if the service is unreachable or times out.
    |
    | The default URL is OSRM's public demo server, which is intended for
    | LIGHT DEVELOPMENT USE ONLY — it is rate-limited and not for production.
    | Self-host OSRM or swap to OpenRouteService for real deployments.
    |
    */
    'routing' => [
        'enabled' => env('LAKBAI_ROUTE_ESTIMATES', true),
        'provider' => env('ROUTING_PROVIDER', 'osrm'),
        'osrm_url' => env('LAKBAI_OSRM_URL', 'https://router.project-osrm.org'),
        'timeout' => env('LAKBAI_OSRM_TIMEOUT', 4),
        'cache_ttl' => env('LAKBAI_ROUTE_CACHE_TTL', 86400),
        'ors_api_key' => env('ORS_API_KEY'),
        'circuit_breaker_seconds' => (int) env('LAKBAI_ROUTE_BREAKER_SECONDS', 60),
        'simplify_tolerance_m' => (float) env('LAKBAI_ROUTE_SIMPLIFY_TOLERANCE_M', 5),
        // Assumed average driving speed used for Haversine fallbacks (km/h).
        'fallback_speed_kmh' => env('LAKBAI_ROUTE_FALLBACK_SPEED_KMH', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Itinerary Exports
    |--------------------------------------------------------------------------
    |
    | Exports (PDF / ICS / GPX) are throttled per user to avoid abuse.
    |
    */
    'export' => [
        'throttle' => env('LAKBAI_EXPORT_THROTTLE', '20,1'),
        'timezone' => env('LAKBAI_EXPORT_TIMEZONE', 'Asia/Manila'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Itinerary Sharing & Collaboration
    |--------------------------------------------------------------------------
    |
    | Sharing settings used by invites, member caps and the frontend link
    | builder.
    |
    */
    'sharing' => [
        // Base URL used to build shareable invite links in API responses.
        'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')),
        // Maximum number of collaborators per itinerary (owner excluded).
        'max_members' => (int) env('LAKBAI_MAX_ITINERARY_MEMBERS', 20),
        // Maximum active (pending, non-revoked, non-expired, unexhausted) invites.
        'max_invites' => (int) env('LAKBAI_MAX_ITINERARY_INVITES', 20),
        // Invite creation rate limit (attempts, minutes).
        'invite_throttle' => env('LAKBAI_INVITE_THROTTLE', '20,1'),
        // Invite acceptance rate limit (attempts, minutes).
        'invite_accept_throttle' => env('LAKBAI_INVITE_ACCEPT_THROTTLE', '10,1'),
        // Default invite expiry in days when not specified.
        'default_expiry_days' => (int) env('LAKBAI_INVITE_EXPIRY_DAYS', 7),
        // Maximum invite expiry in days.
        'max_expiry_days' => (int) env('LAKBAI_INVITE_MAX_EXPIRY_DAYS', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Friends
    |--------------------------------------------------------------------------
    |
    | Settings for the friends system.
    |
    */
    'friends' => [
        'resend_cooldown_days' => (int) env('LAKBAI_FRIEND_RESEND_COOLDOWN_DAYS', 7),
        'request_throttle' => env('LAKBAI_FRIEND_REQUEST_THROTTLE', '15,1'),
        'friend_code_regen_throttle' => env('LAKBAI_FRIEND_CODE_REGEN_THROTTLE', '5,1'),
        'read_throttle' => env('LAKBAI_FRIEND_READ_THROTTLE', '60,1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Notifications
    |--------------------------------------------------------------------------
    |
    | In-app notifications are always stored. Email is opt-in per type and is
    | only attempted when a real mail transport is configured. Shared trip
    | edits are batched so collaborators receive at most one unread update per
    | trip per window.
    |
    */
    'notifications' => [
        'batch_window_minutes' => (int) env('LAKBAI_NOTIFICATION_BATCH_WINDOW_MINUTES', 15),
        'starting_soon_days' => (int) env('LAKBAI_NOTIFICATION_STARTING_SOON_DAYS', 2),
        'prune_read_days' => (int) env('LAKBAI_NOTIFICATION_PRUNE_READ_DAYS', 30),
        'prune_all_days' => (int) env('LAKBAI_NOTIFICATION_PRUNE_ALL_DAYS', 90),
    ],

    /*
    |--------------------------------------------------------------------------
    | Live Trip Tracking
    |--------------------------------------------------------------------------
    |
    | Rules for solo live tracking. The client sends batches of raw positions;
    | every filter below runs on the server. Change thresholds here, not in the
    | mobile app, so web and future clients stay consistent.
    |
    */
    'tracking' => [
        // Reject points whose reported accuracy radius is worse than this.
        'max_accuracy_m' => (int) env('LAKBAI_TRACKING_MAX_ACCURACY_M', 100),
        // Reject a point timestamped further than this into the future.
        'max_future_seconds' => (int) env('LAKBAI_TRACKING_MAX_FUTURE_SECONDS', 60),
        // Reject a point older than this when it reaches the API.
        'max_point_age_seconds' => (int) env('LAKBAI_TRACKING_MAX_POINT_AGE_SECONDS', 600),
        // Reject a jump faster than this between two accepted points (km/h).
        'max_jump_speed_kmh' => (float) env('LAKBAI_TRACKING_MAX_JUMP_SPEED_KMH', 200),
        // Distances smaller than this are GPS jitter and are not accumulated.
        'min_distance_m' => (float) env('LAKBAI_TRACKING_MIN_DISTANCE_M', 5),
        // Gaps longer than this break the route; distance is not accumulated.
        'max_gap_seconds' => (int) env('LAKBAI_TRACKING_MAX_GAP_SECONDS', 300),
        // Persist at most one raw point per session per this many seconds.
        'sample_seconds' => (int) env('LAKBAI_TRACKING_SAMPLE_SECONDS', 10),
        // Maximum points accepted in one batch request.
        'batch_max' => (int) env('LAKBAI_TRACKING_BATCH_MAX', 50),
        // API throttle for the points endpoint (attempts, minutes).
        'points_throttle' => env('LAKBAI_TRACKING_POINTS_THROTTLE', '30,1'),
        // Default arrival radius when a stop has no destination radius.
        'arrival_radius_m' => (int) env('LAKBAI_TRACKING_ARRIVAL_RADIUS_M', 150),
        // Undo a completed stop within this many minutes.
        'undo_minutes' => (int) env('LAKBAI_TRACKING_UNDO_MINUTES', 10),
        // Auto-expire active trips with no point for this many hours.
        'stale_active_hours' => (int) env('LAKBAI_TRACKING_STALE_ACTIVE_HOURS', 24),
        // Auto-cancel paused trips after this many days.
        'stale_paused_days' => (int) env('LAKBAI_TRACKING_STALE_PAUSED_DAYS', 7),
        // Keep raw points this many days after completion, then prune.
        'retention_days' => (int) env('LAKBAI_TRACKING_RETENTION_DAYS', 90),

        // Group live tracking (opt-in, per traveller).
        // A member position is broadcast at most once per this many seconds.
        'group_broadcast_seconds' => (int) env('LAKBAI_TRACKING_GROUP_BROADCAST_SECONDS', 5),
        // A member is "online" while their last shared ping is younger than this.
        'group_online_seconds' => (int) env('LAKBAI_TRACKING_GROUP_ONLINE_SECONDS', 60),
        // Cached latest position expires after this long without a ping.
        'group_position_ttl_seconds' => (int) env('LAKBAI_TRACKING_GROUP_POSITION_TTL_SECONDS', 120),
        // Sharing is automatically stopped after this many hours without a ping.
        'group_stale_sharing_hours' => (int) env('LAKBAI_TRACKING_GROUP_STALE_SHARING_HOURS', 12),
        // A "Meet here" pin expires after this many minutes.
        'meetup_ttl_minutes' => (int) env('LAKBAI_TRACKING_MEETUP_TTL_MINUTES', 120),
        // Client polling fallback when the WebSocket is unavailable.
        'group_poll_seconds' => (int) env('LAKBAI_TRACKING_GROUP_POLL_SECONDS', 10),
        // Never send more than one group arrival notification per trip per window.
        'group_arrival_notify_minutes' => (int) env('LAKBAI_TRACKING_GROUP_ARRIVAL_NOTIFY_MINUTES', 30),
        // Send in-app group arrival notifications at all.
        'group_arrival_notify' => (bool) env('LAKBAI_TRACKING_GROUP_ARRIVAL_NOTIFY', true),
        // API throttles for group reads/writes (attempts, minutes).
        'group_read_throttle' => env('LAKBAI_TRACKING_GROUP_READ_THROTTLE', '120,1'),
        'group_write_throttle' => env('LAKBAI_TRACKING_GROUP_WRITE_THROTTLE', '30,1'),
        // Cache store for group positions. Null uses the app default (database),
        // set to "redis" when a Redis cache is available.
        'group_cache_store' => env('LAKBAI_TRACKING_GROUP_CACHE_STORE'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Trip Recaps
    |--------------------------------------------------------------------------
    |
    | A completed trip gets a shareable recap. Raw tracking points are
    | simplified before they are stored, and public links never expose the
    | exact first/last metres of a route unless the owner turns that off.
    |
    */
    'recap' => [
        // Photos are capped per traveller per trip.
        'max_photos_per_user' => (int) env('LAKBAI_RECAP_MAX_PHOTOS_PER_USER', 20),
        'max_photo_kb' => (int) env('LAKBAI_RECAP_MAX_PHOTO_KB', 5120),
        // Longest edge of the generated thumbnail, in pixels.
        'thumbnail_max_px' => (int) env('LAKBAI_RECAP_THUMBNAIL_MAX_PX', 480),
        // Longest edge kept for the full-size re-encoded photo.
        'max_image_px' => (int) env('LAKBAI_RECAP_MAX_IMAGE_PX', 2400),
        // Route simplification tolerance (Ramer-Douglas-Peucker, metres).
        'simplify_tolerance_m' => (float) env('LAKBAI_RECAP_SIMPLIFY_TOLERANCE_M', 15),
        // How much of each route end a public link trims when endpoints are hidden.
        'privacy_radius_m' => (float) env('LAKBAI_RECAP_PRIVACY_RADIUS_M', 300),
        // Default and maximum share-link lifetimes in days.
        'share_days' => (int) env('LAKBAI_RECAP_SHARE_DAYS', 30),
        'max_share_days' => (int) env('LAKBAI_RECAP_MAX_SHARE_DAYS', 365),
        // API throttles (attempts, minutes).
        'share_throttle' => env('LAKBAI_RECAP_SHARE_THROTTLE', '10,1'),
        'upload_throttle' => env('LAKBAI_RECAP_UPLOAD_THROTTLE', '30,1'),
        'public_throttle' => env('LAKBAI_RECAP_PUBLIC_THROTTLE', '30,1'),
        'meta_throttle' => env('LAKBAI_RECAP_META_THROTTLE', '60,1'),
        // Base URL for the server-rendered Open Graph page and share links.
        'public_base_url' => rtrim(env('LAKBAI_PUBLIC_BASE_URL', env('APP_URL', 'http://localhost')), '/'),
        // Where the Open Graph page sends real browsers (the SPA route /s/{token}).
        'app_url' => rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/'),
    ],
];
