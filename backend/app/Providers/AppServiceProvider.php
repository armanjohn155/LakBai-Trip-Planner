<?php

namespace App\Providers;

use App\Events\TripCompleted;
use App\Events\TripDeleted;
use App\Listeners\BuildTripRecap;
use App\Listeners\CleanupTripPhotos;
use App\Listeners\NotificationEventSubscriber;
use App\Models\Review;
use App\Observers\ReviewObserver;
use App\Services\CheckInVerifier;
use App\Services\RouteEstimator;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(CheckInVerifier::class, fn () => CheckInVerifier::fromConfig());
        $this->app->bind(RouteEstimator::class, fn () => RouteEstimator::fromConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ((bool) env('APP_FORCE_HTTPS', false)) {
            URL::forceScheme('https');
        }

        Review::observe(ReviewObserver::class);

        Event::subscribe(NotificationEventSubscriber::class);

        Event::listen(TripCompleted::class, BuildTripRecap::class);
        Event::listen(TripDeleted::class, CleanupTripPhotos::class);

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
            $email = urlencode($notifiable->getEmailForPasswordReset());

            return "{$frontendUrl}/reset-password?token={$token}&email={$email}";
        });
    }
}
