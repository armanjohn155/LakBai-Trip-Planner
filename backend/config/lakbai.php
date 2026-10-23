<?php

return [
    'sharing' => [
        'max_members' => (int) env('LAKBAI_SHARING_MAX_MEMBERS', 20),
        'max_invites' => (int) env('LAKBAI_SHARING_MAX_INVITES', 20),
    ],

<<<<<<< HEAD
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
=======
    'frontend_url' => rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')), '/'),
>>>>>>> origin/main
];
