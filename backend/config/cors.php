<?php

$configuredOrigins = array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')));

$localOrigins = env('APP_ENV') === 'local'
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : [];

$allowedOrigins = array_values(array_filter(array_unique(array_merge(
    $configuredOrigins,
    [env('FRONTEND_URL')],
    $localOrigins,
))));

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin requests may execute
    | in the browser. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'auth/google/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
