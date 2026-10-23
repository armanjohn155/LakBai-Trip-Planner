<?php

namespace App\Providers;

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
    }
}
