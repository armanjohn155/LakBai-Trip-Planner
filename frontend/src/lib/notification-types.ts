import type { Paginated } from "@/lib/types";

export type NotificationType =
  | "friend.request_received"
  | "friend.request_accepted"
  | "trip.invite_received"
  | "trip.invite_accepted"
  | "trip.invite_declined"
  | "trip.member_joined"
  | "trip.member_left"
  | "trip.member_removed"
  | "trip.role_changed"
  | "trip.ownership_transferred"
  | "trip.itinerary_deleted"
  | "trip.updated"
  | "trip.starting_soon"
  | "review.hidden"
  | "review.reported";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  action_url: string | null;
  actionable: boolean;
  data: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export interface NotificationPreferences {
  mail_configured: boolean;
  channels: string[];
  preferences: Array<{
    type: NotificationType;
    label: string;
    channels: Record<string, boolean>;
  }>;
}

export type NotificationListResponse = Paginated<AppNotification>;
