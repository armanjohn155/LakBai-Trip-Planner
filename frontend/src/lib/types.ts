// Region names are admin-managed; keep the alias for existing imports.
export type Region = string;

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
  categories: Record<string, number>;
  per_month: { month: string; label: string; count: number }[];
  first_visit: Visit | null;
  latest_visit: Visit | null;
}

export interface VisitedMapPlace {
  destination_id: number;
  name: string;
  latitude: string;
  longitude: string;
  verified: boolean;
  last_visited_at: string;
  visit_count: number;
}

export type ReviewReportReason = "spam" | "offensive" | "fake" | "irrelevant" | "other";

export interface ReviewPhoto {
  id: number;
  url: string;
}

export interface ReviewAuthor {
  id: number;
  name: string;
}

export interface Review {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  visited_on: string | null;
  is_hidden: boolean;
  hidden_reason?: string | null;
  edited_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author: ReviewAuthor;
  destination?: { id: number; name: string };
  photos: ReviewPhoto[];
  report_count?: number;
  can?: {
    update: boolean;
    delete: boolean;
    report: boolean;
  };
}

export type SortBy = "popular" | "rating" | "reviews" | "name";

export type PriceTier = "" | "free" | "1" | "2" | "3";

export interface ExplorerFilters {
  search: string;
  categories: string[];
  municipalities: string[];
  priceTier: PriceTier;
  minRating: number;
  sortBy: SortBy;
}

export interface DestinationFilters {
  category?: string;
  region?: Region | "";
  search?: string;
  min_price?: number | "";
  max_price?: number | "";
}

export type ItineraryItemStatus = "planned" | "arrived" | "done" | "skipped";

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
  day_number: number;
  order: number;
  start_time: string | null;
  duration_minutes: number | null;
  estimated_budget: string | number | null;
  notes: string | null;
  visited: boolean;
  status: ItineraryItemStatus;
  arrived_at?: string | null;
  completed_at?: string | null;
  visit_id?: number | null;
  unavailable: boolean;
  verified: boolean;
  updated_by?: number | null;
  destination?: Destination;
}

export interface ItinerarySummaryDay {
  day_number: number;
  item_count: number;
  estimated_budget: number | null;
  duration_minutes: number;
}

export interface ItineraryBudgetSummary {
  total_estimated_budget: number | null;
  budget_limit: number | null;
  remaining_budget: number | null;
  over_budget: boolean;
}

export interface ItineraryRouteLeg {
  from_stop_id: number;
  to_stop_id: number;
  distance_m: number | null;
  duration_s: number | null;
  source: string | null;
}

export interface ItineraryRouteEstimate {
  enabled: boolean;
  days: Array<{ day_number: number; legs: ItineraryRouteLeg[] }>;
}

export type RouteProfile = "driving" | "motorcycle" | "walking" | "cycling";

export interface RouteGeometryResponse {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance_m: number;
  duration_s: number;
  legs: { distance_m: number; duration_s: number }[];
  provider: string;
  approximate: boolean;
  reason?: "no_road_route" | "provider_unavailable" | "rate_limited";
}

export interface TrackingPosition {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  heading?: number | null;
  speed?: number | null;
  recorded_at?: string | null;
}

export interface TrackingNextStop {
  id: number;
  title: string;
  day_number: number;
  order: number;
  latitude: number | null;
  longitude: number | null;
  status: ItineraryItemStatus;
  distance_m: number | null;
  bearing: number | null;
}

export interface TripTrackingSummary {
  itinerary_id: number;
  lifecycle_status: TripLifecycleStatus;
  session_status: "active" | "paused" | "ended" | "inactive";
  distance_m: number;
  elapsed_seconds: number;
  moving_seconds: number;
  last_position: TrackingPosition | null;
  next_stop: TrackingNextStop | null;
  can_finish: boolean;
  started_at: string | null;
  paused_at: string | null;
}

export interface GroupTrackingMember {
  user_id: number;
  name: string;
  avatar_url: string | null;
  role: TripRole | null;
  is_me: boolean;
  sharing: boolean;
  session_status?: "active" | "paused" | "ended" | null;
  online: boolean | null;
  last_seen_at: string | null;
  distance_to_next_stop_m?: number | null;
  position: TrackingPosition | null;
  arrived_stop: { id: number; title: string; at: string | null } | null;
}

export interface GroupTrackingMeetup {
  id: number;
  lat: number;
  lng: number;
  note: string | null;
  created_by: number;
  created_by_name: string | null;
  expires_at: string | null;
}

export interface GroupTrackingState {
  itinerary_id: number;
  lifecycle_status: TripLifecycleStatus;
  group: true;
  poll_seconds: number;
  next_stop?: { id: number; title: string } | null;
  me: {
    user_id: number;
    role: TripRole | null;
    sharing: boolean;
    online: boolean;
    position: TrackingPosition | null;
  };
  members: GroupTrackingMember[];
  meetup: GroupTrackingMeetup | null;
}

export interface TrackingPointPayload {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  recorded_at: string;
}

export interface TrackingBatchResult {
  accepted: number;
  rejected: number;
  distance_m: number;
  session_status: string | null;
}

export interface TripTransitionResult {
  itinerary: Itinerary;
  tracking: TripTrackingSummary;
}

export type TripType = "solo" | "group";
export type TripLifecycleStatus = "planned" | "active" | "paused" | "completed" | "cancelled";
export type TripRole = "owner" | "editor" | "viewer";
export type TripMemberStatus = "pending" | "accepted" | "declined";
export type TripRsvp = "going" | "maybe" | "declined";

export interface Itinerary {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | number | null;
  total_budget: string | number | null;
  budget_limit: number | null;
  cover_image_url: string | null;
  is_template: boolean;
  template_key: string | null;
  trip_type: TripType;
  lifecycle_status?: TripLifecycleStatus;
  started_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;
  total_paused_seconds?: number;
  distance_m?: number;
  moving_seconds?: number;
  started_by?: number | null;
  can_finish?: boolean;
  day_count: number;
  item_count?: number;
  summary: ItineraryBudgetSummary;
  items?: ItineraryItem[];
  created_at?: string;
  updated_at?: string;
  version?: number;
  share_budget?: boolean;
  my_role?: TripRole | null;
  my_status?: TripMemberStatus | null;
  is_shared?: boolean;
  member_count?: number;
  members?: ItineraryMember[];
  updated_by?: string | null;
  owner?: { id: number; name: string | null; username?: string | null; avatar_url?: string | null; email?: string } | null;
}

export interface PendingInvite {
  id: number;
  title: string;
  trip_type: TripType;
  my_role: null;
  my_status: "pending";
  invited_role: "editor" | "viewer";
  member_count?: number;
  owner: { id: number; name: string | null; username?: string | null; avatar_url?: string | null };
  invited_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ItineraryTemplate {
  id: number;
  template_key: string | null;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  day_count: number;
  item_count: number;
  budget_limit: string | number | null;
  estimated_total: number;
  items?: ItineraryItem[];
}

export type ExportFormat = "pdf" | "ics" | "gpx";

export interface BudgetBreakdown {
  category: string;
  item_count: number;
  estimated_budget: number;
}

export interface ItinerarySummary {
  itinerary_id: number;
  title: string;
  budget: string | number | null;
  total_budget: number | null;
  budget_limit: number | null;
  remaining_budget: number | null;
  over_budget: boolean;
  item_count: number;
  day_count: number;
  total_duration_minutes: number;
  days: ItinerarySummaryDay[];
  breakdown_by_category: BudgetBreakdown[];
}

export interface ItineraryChanges {
  data: {
    version: number;
    changed: boolean;
    updated_by: string | null;
    activities: ItineraryActivity[];
  };
}


export interface ItineraryMember {
  id: number;
  name: string;
  username?: string | null;
  avatar_url?: string | null;
  role: TripRole;
  status?: TripMemberStatus;
  rsvp?: TripRsvp | null;
  invited_at?: string | null;
  responded_at?: string | null;
  joined_at?: string | null;
}

export interface ItineraryInvite {
  id: number;
  email?: string | null;
  type: 'email' | 'link';
  role: 'editor' | 'viewer';
  max_uses?: number | null;
  uses_count: number;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  is_redeemable?: boolean;
}

export interface ItineraryActivity {
  id: number;
  action: string;
  user?: string | null;
  subject_type?: string | null;
  subject_id?: number | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
}

export interface InvitePreview {
  itinerary_id?: number;
  itinerary_name: string;
  owner_name?: string | null;
  owner_username?: string | null;
  owner?: {
    name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  };
  type?: "email" | "link";
  role: "editor" | "viewer";
  expires_at?: string | null;
  member_count?: number;
}

export interface UserSettings {
  email_reminders: boolean;
  digest: boolean;
  marketing: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string | null;
  friend_code?: string | null;
  friend_code_regenerated_at?: string | null;
  role?: "user" | "admin";
  avatar_url?: string | null;
  created_at?: string | null;
  settings?: UserSettings | null;
}

export interface AuthPayload {
  user: User;
  token: string;
}

export interface FriendUser {
  id: number;
  name: string;
  username?: string | null;
  avatar_url?: string | null;
}

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export interface Friendship {
  id: number;
  status: FriendshipStatus;
  requester_id: number;
  addressee_id: number;
  responded_at?: string | null;
  created_at?: string | null;
  user: FriendUser | null;
}

export interface FriendCode {
  friend_code: string | null;
  friend_code_regenerated_at: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/* ── Completed-trip recaps ─────────────────────────────────────────────── */

export type RecapVisibility = "private" | "members" | "link" | "public";
export type RecapAccent = "surf" | "mango" | "magenta" | "sea" | "royal";

/** A photo as returned by the recap and photo endpoints. */
export interface TripPhoto {
  id: number;
  url: string;
  thumbnail_url: string;
  caption: string | null;
  taken_at: string | null;
  itinerary_item_id: number | null;
  position: number;
  is_hidden: boolean;
  /** Only present on member payloads. */
  user?: { id: number; name: string | null };
  itinerary_id?: number;
  user_id?: number;
}

export interface RecapStats {
  distance_m: number | null;
  moving_seconds: number | null;
  elapsed_seconds: number | null;
  days: number | null;
  stops_total: number | null;
  stops_visited: number | null;
  stops_skipped: number | null;
  verified_visits: number | null;
  average_speed_kmh: number | null;
  travellers?: number | null;
  /** Owner/editor only; null for viewers without budget sharing. */
  spend_planned?: number | null;
  spend_estimated?: number | null;
}

export interface RecapRouteFeature {
  type: "Feature";
  properties: { day: number; sequence: number; point_count: number };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface RecapRoute {
  type: "FeatureCollection";
  features: RecapRouteFeature[];
}

/**
 * Stops share one shape. Member payloads add private fields (notes,
 * destination id, verification) while the public payload simply omits them.
 */
export interface RecapStop {
  id: number;
  day_number: number;
  order: number;
  title: string;
  category: string | null;
  municipality: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ItineraryItemStatus;
  photo_ids: number[];
  destination_id?: number | null;
  start_time?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  verified?: boolean;
  notes?: string | null;
}

export interface RecapMember {
  id: number;
  name: string;
  username: string | null;
  avatar_url: string | null;
  role: TripRole;
}

export interface RecapShareState {
  active: boolean;
  has_link: boolean;
  expires_at: string | null;
  /** Raw links are never stored, so this is always null on reads. */
  url: string | null;
}

export interface TripRecap {
  id: number;
  itinerary_id: number;
  title: string;
  summary: string | null;
  start_date: string | null;
  end_date: string | null;
  day_count: number;
  lifecycle_status: TripLifecycleStatus;
  completed_at: string | null;
  cover_photo_id: number | null;
  cover_photo: TripPhoto | null;
  visibility: RecapVisibility;
  hide_endpoints: boolean;
  show_stats: boolean;
  show_photos: boolean;
  theme_accent: RecapAccent;
  stats: RecapStats | null;
  route: RecapRoute;
  stops: RecapStop[];
  photos: TripPhoto[];
  members: RecapMember[];
  member_count: number;
  share: RecapShareState;
  permissions: {
    can_edit: boolean;
    can_upload_photos: boolean;
  };
}

/** Strict whitelist returned by `/api/shared/recaps/{token}`. */
export interface PublicTripRecap {
  title: string;
  summary: string | null;
  start_date: string | null;
  end_date: string | null;
  day_count: number;
  theme_accent: RecapAccent;
  hide_endpoints: boolean;
  cover_photo: TripPhoto | null;
  stats: RecapStats | null;
  route: RecapRoute;
  stops: RecapStop[];
  photos: TripPhoto[];
}

export interface TripRecapPayload {
  title?: string;
  summary?: string | null;
  visibility?: RecapVisibility;
  hide_endpoints?: boolean;
  show_stats?: boolean;
  show_photos?: boolean;
  theme_accent?: RecapAccent;
  cover_photo_id?: number | null;
}

export interface TripPhotoPayload {
  caption?: string | null;
  taken_at?: string | null;
  itinerary_item_id?: number | null;
  is_hidden?: boolean;
}

export interface RecapShareLink {
  token: string;
  url: string;
  expires_at: string | null;
  visibility: RecapVisibility;
}
