export type Region = "Metro Cebu" | "North Cebu" | "South Cebu";

export interface Destination {
  id: number;
  name: string;
  description: string;
  category: string;
  region: Region;
  municipality: string | null;
  latitude: string;
  longitude: string;
  radius_m?: number;
  estimated_cost: string | null;
  rating: number | null;
  review_count: number | null;
  lakbai_review_count?: number;
  image_url: string | null;
  best_time_to_visit: string | null;
  tips: string | null;
  is_favorited?: boolean;
  user_visit_status?: VisitStatus;
  deleted_at?: string | null;
  highlights?: string[];
  entrance_fee_text?: string | null;
  visit_duration?: string | null;
  opening_hours?: string | null;
  how_to_get_there?: Array<{
    mode?: string;
    route?: string;
    duration?: string;
    price_text?: string;
  }>;
  travel_tips?: string[];
  gallery?: string[];
}

export type VisitStatus = "none" | "manual" | "verified";

export type VisitMethod = "gps" | "manual";

export interface Visit {
  id: number;
  destination_id: number;
  itinerary_stop_id: number | null;
  verified: boolean;
  method: VisitMethod;
  latitude: string | null;
  longitude: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  visited_at: string;
  notes: string | null;
  destination?: Destination;
}

export interface VisitStats {
  total_visits: number;
  verified_visits: number;
  unique_destinations: number;
  regions_covered: string[];
}

export interface Review {
  id: number;
  destination_id: number;
  user_id: number;
  itinerary_id: number | null;
  rating: number;
  title: string | null;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  is_lakbai: boolean;
  source: string | null;
  verified_visit: boolean;
  created_at: string;
  updated_at: string;
  user?: UserSummary;
  destination?: Destination;
}

export interface UserSummary {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface DestinationFilters {
  category?: string;
  region?: Region | "";
  search?: string;
  min_price?: number | "";
  max_price?: number | "";
}

export type ItineraryItemStatus = "planned" | "done" | "skipped";

export interface ItineraryItem {
  id: number;
  itinerary_id: number;
  destination_id: number | null;
  custom_title: string | null;
  custom_latitude: string | number | null;
  custom_longitude: string | number | null;
  custom_address: string | null;
  is_custom: boolean;
  title: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_cost: string | number | null;
  visit_duration: string | null;
  notes: string | null;
  order: number;
  status: ItineraryItemStatus;
  destination?: Destination | null;
}

export interface Itinerary {
  id: number;
  user_id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  cover_image_url: string | null;
  visibility: "private" | "shared" | "public";
  share_token: string | null;
  is_public: boolean;
  share_expires_at: string | null;
  trip_type: "solo" | "group";
  created_at: string;
  updated_at: string;
  items?: ItineraryItem[];
  collaborators?: ItineraryCollaborator[];
  invites?: ItineraryInvite[];
}

export interface ItineraryCollaborator {
  id: number;
  itinerary_id: number;
  user_id: number;
  role: "owner" | "editor" | "viewer";
  added_at: string | null;
  user?: UserSummary;
}

export interface ItineraryInvite {
  id: number;
  itinerary_id: number;
  invited_by: number;
  invited_email: string;
  invited_user_id: number | null;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "declined" | "expired";
  token: string;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
  inviter?: UserSummary;
  invited_user?: UserSummary;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  role: "user" | "admin";
  status: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  user: User;
}

export interface Friend {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  status: string;
  pivot?: { status: "pending" | "accepted" | "blocked"; direction?: "incoming" | "outgoing" };
}

export interface Friendship {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: "pending" | "accepted" | "blocked";
  requester?: Friend;
  addressee?: Friend;
}

export interface Notification {
  id: string;
  type: string;
  notifiable_type: string;
  notifiable_id: number;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: number;
  user_id: number;
  type: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
