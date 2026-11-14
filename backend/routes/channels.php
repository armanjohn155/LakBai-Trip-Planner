<?php

use App\Models\Itinerary;
use App\Models\User;
use App\Services\GroupTrackingService;
use Illuminate\Support\Facades\Broadcast;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

Broadcast::channel('App.Models.User.{id}', function (User $user, int $id) {
    return (int) $user->id === $id;
});

/*
 * Group live tracking. The channel is only readable while the traveller is
 * accepted on the trip AND currently opted in to sharing their own position.
 * Non-members get a 404 so trip existence never leaks; accepted members who
 * are not sharing (or whose trip is no longer active) get a 403.
 */
Broadcast::channel('itinerary.{itinerary}.tracking', function (User $user, string $itinerary) {
    $trip = Itinerary::query()->find($itinerary);

    if ($trip === null || $trip->roleFor($user) === null) {
        throw new NotFoundHttpException;
    }

    return app(GroupTrackingService::class)->isSharing($trip, $user);
});
