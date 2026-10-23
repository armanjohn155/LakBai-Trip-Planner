<?php

namespace App\Listeners;

use App\Events\FriendRequestAccepted;
use App\Events\FriendRequestSent;
use App\Events\ReviewHidden;
use App\Events\ReviewReported;
use App\Events\TripDeleted;
use App\Events\TripInviteAccepted;
use App\Events\TripInviteDeclined;
use App\Events\TripInviteSent;
use App\Events\TripMemberJoinedViaLink;
use App\Events\TripMemberLeft;
use App\Events\TripMemberRemoved;
use App\Events\TripMemberRoleChanged;
use App\Events\TripOwnershipTransferred;
use App\Events\TripUpdated;
use App\Notifications\FriendRequestAcceptedNotification;
use App\Notifications\FriendRequestReceivedNotification;
use App\Notifications\ReviewHiddenNotification;
use App\Notifications\ReviewReportedNotification;
use App\Notifications\TripInviteAcceptedNotification;
use App\Notifications\TripInviteDeclinedNotification;
use App\Notifications\TripInviteReceivedNotification;
use App\Notifications\TripItineraryDeletedNotification;
use App\Notifications\TripMemberJoinedNotification;
use App\Notifications\TripMemberLeftNotification;
use App\Notifications\TripMemberRemovedNotification;
use App\Notifications\TripOwnershipTransferredNotification;
use App\Notifications\TripRoleChangedNotification;
use App\Services\NotificationDispatcher;
use Illuminate\Events\Dispatcher;

/**
 * Single subscription point that turns domain events into notifications.
 * Keeping the mapping here makes it easy to audit who hears about what.
 */
class NotificationEventSubscriber
{
    public function __construct(private readonly NotificationDispatcher $notifications) {}

    /**
     * @return array<class-string, string>
     */
    public function subscribe(Dispatcher $events): array
    {
        return [
            FriendRequestSent::class => 'onFriendRequestSent',
            FriendRequestAccepted::class => 'onFriendRequestAccepted',
            TripInviteSent::class => 'onTripInviteSent',
            TripInviteAccepted::class => 'onTripInviteAccepted',
            TripInviteDeclined::class => 'onTripInviteDeclined',
            TripMemberJoinedViaLink::class => 'onTripMemberJoinedViaLink',
            TripMemberLeft::class => 'onTripMemberLeft',
            TripMemberRemoved::class => 'onTripMemberRemoved',
            TripMemberRoleChanged::class => 'onTripMemberRoleChanged',
            TripOwnershipTransferred::class => 'onTripOwnershipTransferred',
            TripDeleted::class => 'onTripDeleted',
            TripUpdated::class => 'onTripUpdated',
            ReviewHidden::class => 'onReviewHidden',
            ReviewReported::class => 'onReviewReported',
        ];
    }

    public function onFriendRequestSent(FriendRequestSent $event): void
    {
        $this->notifications->send(
            $event->addressee,
            new FriendRequestReceivedNotification($event->friendship, $event->requester),
            $event->requester,
        );
    }

    public function onFriendRequestAccepted(FriendRequestAccepted $event): void
    {
        $this->notifications->send(
            $event->requester,
            new FriendRequestAcceptedNotification($event->friendship, $event->addressee),
            $event->addressee,
        );
    }

    public function onTripInviteSent(TripInviteSent $event): void
    {
        $this->notifications->send(
            $event->invitee,
            new TripInviteReceivedNotification($event->itinerary, $event->inviter, $event->role),
            $event->inviter,
        );
    }

    public function onTripInviteAccepted(TripInviteAccepted $event): void
    {
        $owner = $event->itinerary->user;

        if ($owner) {
            $this->notifications->send(
                $owner,
                new TripInviteAcceptedNotification($event->itinerary, $event->user),
                $event->user,
            );
        }
    }

    public function onTripInviteDeclined(TripInviteDeclined $event): void
    {
        $owner = $event->itinerary->user;

        if ($owner) {
            $this->notifications->send(
                $owner,
                new TripInviteDeclinedNotification($event->itinerary, $event->user),
                $event->user,
            );
        }
    }

    public function onTripMemberJoinedViaLink(TripMemberJoinedViaLink $event): void
    {
        $this->notifications->sendToTrip(
            $event->itinerary,
            new TripMemberJoinedNotification($event->itinerary, $event->user),
            $event->user,
        );
    }

    public function onTripMemberLeft(TripMemberLeft $event): void
    {
        $this->notifications->sendToTrip(
            $event->itinerary,
            new TripMemberLeftNotification($event->itinerary, $event->user),
            $event->user,
        );
    }

    public function onTripMemberRemoved(TripMemberRemoved $event): void
    {
        $this->notifications->send(
            $event->member,
            new TripMemberRemovedNotification($event->itinerary, $event->actor),
            $event->actor,
        );
    }

    public function onTripMemberRoleChanged(TripMemberRoleChanged $event): void
    {
        $this->notifications->send(
            $event->member,
            new TripRoleChangedNotification($event->itinerary, $event->actor, $event->role),
            $event->actor,
        );
    }

    public function onTripOwnershipTransferred(TripOwnershipTransferred $event): void
    {
        $this->notifications->send(
            $event->newOwner,
            new TripOwnershipTransferredNotification($event->itinerary, $event->previousOwner),
            $event->previousOwner,
        );
    }

    public function onTripDeleted(TripDeleted $event): void
    {
        $notification = new TripItineraryDeletedNotification(
            (int) $event->itinerary->id,
            (string) $event->itinerary->title,
            $event->actor,
        );

        $this->notifications->sendMany(
            $this->notifications->tripRecipients($event->itinerary, $event->actor),
            $notification,
            $event->actor,
        );
    }

    public function onTripUpdated(TripUpdated $event): void
    {
        // Member changes have their own targeted notifications.
        if (str_starts_with($event->action, 'member.')) {
            return;
        }

        $this->notifications->sendTripUpdated($event->itinerary, $event->actor, $event->action);
    }

    public function onReviewHidden(ReviewHidden $event): void
    {
        $author = $event->review->user;

        if (! $author) {
            return;
        }

        $this->notifications->send(
            $author,
            new ReviewHiddenNotification((int) $event->review->id, (string) $event->review->title, $event->reason),
            $event->actor,
        );
    }

    public function onReviewReported(ReviewReported $event): void
    {
        $this->notifications->sendToAdmins(
            new ReviewReportedNotification(
                (int) $event->review->id,
                (string) $event->review->title,
                $event->reporter,
                $event->reason,
            ),
            $event->reporter,
        );
    }
}
