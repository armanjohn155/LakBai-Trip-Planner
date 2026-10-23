<?php

namespace App\Support;

/**
 * Stable notification identifiers. These strings are persisted in the
 * notifications table and are safe to use in client-side filters and
 * preference keys. Never rename an existing value.
 */
class NotificationType
{
    public const FRIEND_REQUEST_RECEIVED = 'friend.request_received';

    public const FRIEND_REQUEST_ACCEPTED = 'friend.request_accepted';

    public const TRIP_INVITE_RECEIVED = 'trip.invite_received';

    public const TRIP_INVITE_ACCEPTED = 'trip.invite_accepted';

    public const TRIP_INVITE_DECLINED = 'trip.invite_declined';

    public const TRIP_MEMBER_JOINED = 'trip.member_joined';

    public const TRIP_MEMBER_LEFT = 'trip.member_left';

    public const TRIP_MEMBER_REMOVED = 'trip.member_removed';

    public const TRIP_ROLE_CHANGED = 'trip.role_changed';

    public const TRIP_OWNERSHIP_TRANSFERRED = 'trip.ownership_transferred';

    public const TRIP_ITINERARY_DELETED = 'trip.itinerary_deleted';

    public const TRIP_UPDATED = 'trip.updated';

    public const TRIP_STARTING_SOON = 'trip.starting_soon';

    public const REVIEW_HIDDEN = 'review.hidden';

    public const REVIEW_REPORTED = 'review.reported';

    /**
     * @return array<int, string>
     */
    public static function all(): array
    {
        return [
            self::FRIEND_REQUEST_RECEIVED,
            self::FRIEND_REQUEST_ACCEPTED,
            self::TRIP_INVITE_RECEIVED,
            self::TRIP_INVITE_ACCEPTED,
            self::TRIP_INVITE_DECLINED,
            self::TRIP_MEMBER_JOINED,
            self::TRIP_MEMBER_LEFT,
            self::TRIP_MEMBER_REMOVED,
            self::TRIP_ROLE_CHANGED,
            self::TRIP_OWNERSHIP_TRANSFERRED,
            self::TRIP_ITINERARY_DELETED,
            self::TRIP_UPDATED,
            self::TRIP_STARTING_SOON,
            self::REVIEW_HIDDEN,
            self::REVIEW_REPORTED,
        ];
    }

    public static function exists(string $type): bool
    {
        return in_array($type, self::all(), true);
    }

    /**
     * Optional channels that can be toggled from the preferences screen.
     *
     * @return array<int, string>
     */
    public static function channels(): array
    {
        return ['in_app', 'email'];
    }

    /**
     * Default preference values used until a user saves an override.
     *
     * @return array{in_app: bool, email: bool}
     */
    public static function defaults(string $type): array
    {
        $emailByDefault = [
            self::FRIEND_REQUEST_RECEIVED,
            self::FRIEND_REQUEST_ACCEPTED,
            self::TRIP_INVITE_RECEIVED,
            self::TRIP_STARTING_SOON,
            self::REVIEW_HIDDEN,
        ];

        return [
            'in_app' => true,
            'email' => in_array($type, $emailByDefault, true),
        ];
    }

    public static function label(string $type): string
    {
        return match ($type) {
            self::FRIEND_REQUEST_RECEIVED => 'Friend requests',
            self::FRIEND_REQUEST_ACCEPTED => 'Accepted friend requests',
            self::TRIP_INVITE_RECEIVED => 'Trip invitations',
            self::TRIP_INVITE_ACCEPTED => 'Invitations accepted',
            self::TRIP_INVITE_DECLINED => 'Invitations declined',
            self::TRIP_MEMBER_JOINED => 'Members joining a trip',
            self::TRIP_MEMBER_LEFT => 'Members leaving a trip',
            self::TRIP_MEMBER_REMOVED => 'Removal from a trip',
            self::TRIP_ROLE_CHANGED => 'Your trip role changing',
            self::TRIP_OWNERSHIP_TRANSFERRED => 'Trip ownership transfers',
            self::TRIP_ITINERARY_DELETED => 'Deleted shared trips',
            self::TRIP_UPDATED => 'Shared trip changes',
            self::TRIP_STARTING_SOON => 'Trips starting soon',
            self::REVIEW_HIDDEN => 'Review moderation',
            self::REVIEW_REPORTED => 'Reported reviews (admin)',
            default => $type,
        };
    }
}
