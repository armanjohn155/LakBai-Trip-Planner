<?php

namespace App\Providers;

<<<<<<< HEAD
use App\Listeners\NotificationEventSubscriber;
=======
use App\Models\Itinerary;
use App\Models\ItineraryItem;
>>>>>>> origin/main
use App\Models\Review;
use App\Observers\ReviewObserver;
use App\Policies\ItineraryItemPolicy;
use App\Policies\ItineraryPolicy;
use App\Services\CheckInVerifier;
use App\Services\RouteEstimator;
<<<<<<< HEAD
use Illuminate\Support\Facades\Event;
=======
use Illuminate\Support\Facades\Gate;
>>>>>>> origin/main
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
<<<<<<< HEAD

        Event::subscribe(NotificationEventSubscriber::class);
=======
        Gate::policy(Itinerary::class, ItineraryPolicy::class);
        Gate::policy(ItineraryItem::class, ItineraryItemPolicy::class);
>>>>>>> origin/main
    }
}
