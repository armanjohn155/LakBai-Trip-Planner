<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Administrator Account
    |--------------------------------------------------------------------------
    |
    | Credentials used by the AdminSeeder to create (or update) the
    | administrator account. Read through config so they keep working
    | when the configuration is cached in production.
    |
    */

    'email' => env('ADMIN_EMAIL'),

    'name' => env('ADMIN_NAME', 'Administrator'),

    'password' => env('ADMIN_PASSWORD'),
];
