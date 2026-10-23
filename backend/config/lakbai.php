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
        'enabled' => env('LAKBAI_ROUTE_ESTIMATES', false),
        'osrm_url' => env('LAKBAI_OSRM_URL', 'https://router.project-osrm.org'),
        'timeout' => env('LAKBAI_OSRM_TIMEOUT', 4),
        'cache_ttl' => env('LAKBAI_ROUTE_CACHE_TTL', 86400),
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
];
