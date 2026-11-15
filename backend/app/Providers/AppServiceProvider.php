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
use Illuminate\Support\Facades\Event;
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
        Review::observe(ReviewObserver::class);

        Event::subscribe(NotificationEventSubscriber::class);

        Event::listen(TripCompleted::class, BuildTripRecap::class);
        Event::listen(TripDeleted::class, CleanupTripPhotos::class);
    }
}
