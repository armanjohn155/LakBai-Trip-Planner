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
  unavailable: boolean;
  verified: boolean;
  destination?: Destination;
}

export type ItineraryItemStatus = "planned" | "done" | "skipped";

export interface ItinerarySummaryDay {
  day_number: number;
  item_count: number;
  estimated_budget: number;
  duration_minutes: number;
}

export interface ItineraryBudgetSummary {
  total_estimated_budget: number;
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

export interface Itinerary {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | number | null;
  total_budget: string | number;
  budget_limit: number | null;
  cover_image_url: string | null;
  is_template: boolean;
  template_key: string | null;
  day_count: number;
  item_count?: number;
  summary: ItineraryBudgetSummary;
  items?: ItineraryItem[];
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
  total_budget: number;
  budget_limit: number | null;
  remaining_budget: number | null;
  over_budget: boolean;
  item_count: number;
  day_count: number;
  total_duration_minutes: number;
  days: ItinerarySummaryDay[];
  breakdown_by_category: BudgetBreakdown[];
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
  role?: "user" | "admin";
  avatar_url?: string | null;
  created_at?: string | null;
  settings?: UserSettings | null;
}

export interface AuthPayload {
  user: User;
  token: string;
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