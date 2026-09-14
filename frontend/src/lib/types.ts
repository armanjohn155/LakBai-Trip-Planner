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
  estimated_cost: string | null;
  rating: number | null;
  review_count: number | null;
  image_url: string | null;
  best_time_to_visit: string | null;
  tips: string | null;
  is_favorited?: boolean;
}

export type SortBy = "popular" | "rating" | "reviews" | "name";

export type PriceTier = "" | "free" | "1" | "2" | "3";

export interface ExplorerFilters {
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
  destination_id: number;
  day_number: number;
  order: number;
  estimated_budget: string | number | null;
  notes: string | null;
  visited: boolean;
  destination?: Destination;
}

export interface Itinerary {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  budget: string | number | null;
  total_budget: string | number;
  item_count?: number;
  items?: ItineraryItem[];
  created_at?: string;
  updated_at?: string;
}

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
  item_count: number;
  day_count: number;
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