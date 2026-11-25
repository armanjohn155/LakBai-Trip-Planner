<?php

$defaultDisk = env('FILESYSTEM_DISK', 'local');

$s3Disk = [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION'),
    'bucket' => env('AWS_BUCKET'),
    'url' => env('AWS_URL'),
    'endpoint' => env('AWS_ENDPOINT'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
    'throw' => false,
    'report' => false,
];

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | "public" follows this value so uploaded media can be moved to S3/R2 in
    | production without changing every upload call in the application.
    |
    */

    'default' => $defaultDisk,

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => $defaultDisk === 's3'
            ? $s3Disk
            : [
                'driver' => 'local',
                'root' => storage_path('app/public'),
                'url' => rtrim((string) env('PUBLIC_URL', rtrim((string) env('APP_URL', 'http://localhost'), '/').'/storage'), '/'),
                'visibility' => 'public',
                'throw' => false,
                'report' => false,
            ],

        's3' => $s3Disk,

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
