<?php

return [
    'sharing' => [
        'max_members' => (int) env('LAKBAI_SHARING_MAX_MEMBERS', 20),
        'max_invites' => (int) env('LAKBAI_SHARING_MAX_INVITES', 20),
    ],

    'frontend_url' => rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')), '/'),
];
