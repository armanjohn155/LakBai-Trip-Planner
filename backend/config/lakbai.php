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
];
