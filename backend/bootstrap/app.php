<?php

use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['prefix' => 'api', 'middleware' => ['auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);

        $trustedProxies = trim((string) env('TRUSTED_PROXIES', ''));
        if ($trustedProxies === '' && env('APP_ENV', 'production') === 'production') {
            $trustedProxies = '*';
        }

        if ($trustedProxies !== '') {
            $middleware->trustProxies(
                $trustedProxies === '*' ? '*' : array_values(array_filter(array_map('trim', explode(',', $trustedProxies)))),
                Request::HEADER_X_FORWARDED_FOR
                    | Request::HEADER_X_FORWARDED_HOST
                    | Request::HEADER_X_FORWARDED_PROTO
                    | Request::HEADER_X_FORWARDED_PORT
                    | Request::HEADER_X_FORWARDED_PREFIX,
            );
        }

        $middleware->append(HandleCors::class);
        $middleware->append(AddSecurityHeaders::class);

        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('api/*') ? null : '/login',
        );
    })
    ->withSchedule(function ($schedule): void {
        $schedule->command('invites:prune')->daily();
        $schedule->command('invite-links:prune')->daily();
        $schedule->command('notifications:prune')->daily();
        $schedule->command('trips:notify-starting-soon')->dailyAt('08:00');
        $schedule->command('trips:expire-stale')->hourly();
        $schedule->command('tracking:prune')->daily();
        $schedule->command('tracking:stop-stale-sharing')->everyTenMinutes();
        $schedule->command('tracking:sweep-presence')->everyMinute();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
