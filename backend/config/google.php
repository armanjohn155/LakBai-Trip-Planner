<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Google OAuth 2.0
    |--------------------------------------------------------------------------
    |
    | Obtain credentials from the Google Cloud Console:
    | https://console.cloud.google.com/apis/credentials
    |
    */

    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/auth/google/callback'),

    /*
    |--------------------------------------------------------------------------
    | Scopes
    |--------------------------------------------------------------------------
    |
    | https://developers.google.com/identity/protocols/oauth2/scopes
    |
    */

    'scopes' => [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ],

    /*
    |--------------------------------------------------------------------------
    | Frontend URL & callback URL
    |--------------------------------------------------------------------------
    |
    | After successful Google auth, the backend redirects here with the token.
    | This is the route on the frontend that stores the token and continues.
    |
    */

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    'frontend_callback' => env('GOOGLE_FRONTEND_CALLBACK', rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/').'/auth/google/callback'),

];
