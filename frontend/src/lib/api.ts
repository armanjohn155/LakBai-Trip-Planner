import axios from "axios";

import type { AuthPayload, Destination, ExportFormat, Itinerary, ItineraryItemStatus, ItineraryRouteEstimate, ItinerarySummary, ItineraryTemplate, Paginated, Review, ReviewReportReason, User, UserSettings, Visit, VisitStats, VisitedMapPlace } from "@/lib/types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000/api";

export const API_ORIGIN = new URL(API_URL, window.location.origin).origin;

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("suroy.token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("login")) {
      localStorage.removeItem("suroy.token");
      localStorage.removeItem("suroy.user");
      if (window.location.pathname.startsWith("/app")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

export const apiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 429) {
      return "Too many attempts, please try again later.";
    }
    if (!error.response) {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (status !== undefined && status >= 500) {
      return "Something went wrong on our end. Please try again.";
    }
    const message = error.response.data?.message;
    const errors = error.response.data?.errors as Record<string, string[]> | undefined;
    if (errors) {
      return Object.values(errors).flat()[0] ?? "Something went wrong.";
    }
    if (typeof message === "string") {
      return message;
    }
  }
  return "Something went wrong. Check that the backend is running.";
};

export const getDestinations = async (params: Record<string, string | number | undefined> = {}) => {
  const { data } = await api.get<Paginated<Destination>>("/destinations", { params });
  return data;
};

export const getDestination = async (id: number) => {
  const { data } = await api.get<{ data: Destination }>(`/destinations/${id}`);
  return data.data;
};

export const register = async (payload: { name: string; email: string; password: string; password_confirmation: string }) => {
  const { data } = await api.post<AuthPayload>("/register", payload);
  return data;
};

export const login = async (payload: { email: string; password: string }) => {
  const { data } = await api.post<AuthPayload>("/login", payload);
  return data;
};

export const logout = async () => {
  await api.post("/logout");
};

export const getMe = async () => {
  const { data } = await api.get<{ user: User }>("/user");
  return data.user;
};

export const updateUser = async (payload: { name: string; email: string }) => {
  const { data } = await api.put<{ user: User }>("/user", payload);
  return data.user;
};

export const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append("avatar", file);
  const { data } = await api.post<{ user: User }>("/user/avatar", formData);
  return data.user;
};

export const changePassword = async (payload: { current_password: string; password: string; password_confirmation: string }) => {
  const { data } = await api.post<{ message: string }>("/user/password", payload);
  return data;
};

export const deleteAccount = async (password: string) => {
  const { data } = await api.delete<{ message: string }>("/user", { data: { password } });
  return data;
};

export const getSettings = async () => {
  const { data } = await api.get<{ data: UserSettings }>("/user/settings");
  return data.data;
};

export const updateSettings = async (payload: UserSettings) => {
  const { data } = await api.put<{ data: UserSettings }>("/user/settings", payload);
  return data.data;
};

export interface ItineraryPayload {
  title?: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: string | number | null;
  total_budget?: string | number | null;
  cover_image_url?: string | null;
}

export interface ItineraryItemPayload {
  destination_id?: number | null;
  custom_title?: string | null;
  custom_latitude?: string | number | null;
  custom_longitude?: string | number | null;
  custom_address?: string | null;
  day_number?: number;
  order?: number;
  start_time?: string | null;
  duration_minutes?: number | null;
  category?: string | null;
  estimated_budget?: string | number | null;
  notes?: string | null;
  visited?: boolean;
  status?: ItineraryItemStatus;
}

export interface ReorderStop {
  id: number;
  day_number: number;
  order: number;
}

export const getItineraries = async () => {
  const { data } = await api.get<Paginated<Itinerary>>("/itineraries");
  return data.data;
};

export const createItinerary = async (payload: ItineraryPayload & { title: string }) => {
  const { data } = await api.post<{ data: Itinerary }>("/itineraries", payload);
  return data.data;
};

export const getItinerary = async (id: number) => {
  const { data } = await api.get<{ data: Itinerary }>(`/itineraries/${id}`);
  return data.data;
};

export const updateItinerary = async (id: number, payload: ItineraryPayload) => {
  const { data } = await api.put<{ data: Itinerary }>(`/itineraries/${id}`, payload);
  return data.data;
};

export const deleteItinerary = async (id: number) => {
  await api.delete(`/itineraries/${id}`);
};

export const duplicateItinerary = async (id: number) => {
  const { data } = await api.post<{ data: Itinerary }>(`/itineraries/${id}/duplicate`);
  return data.data;
};

export const getItinerarySummary = async (id: number) => {
  const { data } = await api.get<{ data: ItinerarySummary }>(`/itineraries/${id}/summary`);
  return data.data;
};

export const getItineraryRouteEstimates = async (id: number) => {
  const { data } = await api.get<{ data: ItineraryRouteEstimate }>(`/itineraries/${id}/route-estimates`);
  return data.data;
};

export const addItineraryItem = async (itineraryId: number, payload: ItineraryItemPayload) => {
  const { data } = await api.post<{ data: Itinerary }>(`/itineraries/${itineraryId}/items`, payload);
  return data.data;
};

export const updateItineraryItem = async (itineraryId: number, itemId: number, payload: ItineraryItemPayload) => {
  const { data } = await api.put<{ data: Itinerary }>(`/itineraries/${itineraryId}/items/${itemId}`, payload);
  return data.data;
};

export const deleteItineraryItem = async (itineraryId: number, itemId: number) => {
  await api.delete(`/itineraries/${itineraryId}/items/${itemId}`);
};

export const reorderItineraryItems = async (itineraryId: number, stops: ReorderStop[]) => {
  const { data } = await api.put<{ data: Itinerary }>(`/itineraries/${itineraryId}/items/reorder`, { stops });
  return data.data;
};

export const getItineraryTemplates = async () => {
  const { data } = await api.get<{ data: ItineraryTemplate[] }>("/itinerary-templates");
  return data.data;
};

export const useItineraryTemplate = async (templateId: number) => {
  const { data } = await api.post<{ data: Itinerary }>(`/itinerary-templates/${templateId}/use`);
  return data.data;
};

/**
 * Trigger a browser download of an itinerary export (PDF / ICS / GPX).
 *
 * The filename is taken from the Content-Disposition header with a sensible
 * fallback, and the object URL is always revoked.
 */
export const downloadItineraryExport = async (id: number, format: ExportFormat, fallbackName: string) => {
  const response = await api.get(`/itineraries/${id}/export`, {
    params: { format },
    responseType: "blob",
  });

  const disposition = (response.headers["content-disposition"] as string | undefined) ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `${fallbackName}.${format}`;

  const url = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getFavorites = async (params: Record<string, string | number | undefined> = {}) => {
  const { data } = await api.get<Paginated<Destination>>("/favorites", { params });
  return data;
};

export const addFavorite = async (destinationId: number) => {
  const { data } = await api.post<{ data: Destination }>(`/favorites/${destinationId}`);
  return data.data;
};

export const removeFavorite = async (destinationId: number) => {
  await api.delete(`/favorites/${destinationId}`);
};

export interface AdminDestinationParams {
  search?: string;
  category?: string;
  region?: string;
  status?: "active" | "trashed" | "all";
  sort?: string;
  page?: number;
  per_page?: number;
}

export const getAdminDestinations = async (params: AdminDestinationParams = {}) => {
  const { data } = await api.get<Paginated<Destination>>("/admin/destinations", { params });
  return data;
};

export const getAdminDestination = async (id: number) => {
  const { data } = await api.get<{ data: Destination }>(`/admin/destinations/${id}`);
  return data.data;
};

export const createAdminDestination = async (formData: FormData) => {
  const { data } = await api.post<{ data: Destination }>("/admin/destinations", formData);
  return data.data;
};

export const updateAdminDestination = async (id: number, formData: FormData) => {
  formData.append("_method", "put");
  const { data } = await api.post<{ data: Destination }>(`/admin/destinations/${id}`, formData);
  return data.data;
};

export const deleteAdminDestination = async (id: number) => {
  await api.delete(`/admin/destinations/${id}`);
};

export const restoreAdminDestination = async (id: number) => {
  const { data } = await api.post<{ data: Destination }>(`/admin/destinations/${id}/restore`);
  return data.data;
};

export const forceDeleteAdminDestination = async (id: number) => {
  await api.delete(`/admin/destinations/${id}/force`);
};

export const apiFieldErrors = (error: unknown): Record<string, string> => {
  if (axios.isAxiosError(error)) {
    const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
    if (errors) {
      return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0] ?? "Invalid value."]));
    }
  }
  return {};
};

export const checkIn = async (
  destinationId: number,
  payload: { latitude: number; longitude: number; accuracy: number; itinerary_stop_id?: number | null; notes?: string | null },
) => {
  const { data } = await api.post<{ data: Visit }>(`/destinations/${destinationId}/check-in`, payload);
  return data.data;
};

export const recordManualVisit = async (
  destinationId: number,
  payload: { visited_at: string; itinerary_stop_id?: number | null; notes?: string | null },
) => {
  const { data } = await api.post<{ data: Visit }>(`/destinations/${destinationId}/visits/manual`, payload);
  return data.data;
};

export const getVisits = async (params: Record<string, string | number | boolean | undefined> = {}) => {
  const { data } = await api.get<Paginated<Visit>>("/visits", { params });
  return data;
};

export const getVisitStats = async () => {
  const { data } = await api.get<{ data: VisitStats }>("/visits/stats");
  return data.data;
};

export const getVisitsMap = async () => {
  const { data } = await api.get<{ data: VisitedMapPlace[] }>("/visits/map");
  return data.data;
};

export const deleteVisit = async (visitId: number) => {
  await api.delete(`/visits/${visitId}`);
};

export const getReviews = async (destinationId: number, params: Record<string, string | number | undefined> = {}) => {
  const { data } = await api.get<Paginated<Review>>(`/destinations/${destinationId}/reviews`, { params });
  return data;
};

export const createReview = async (
  destinationId: number,
  payload: { rating: number; title?: string | null; body: string; visited_on?: string | null; photos?: File[] },
) => {
  const formData = new FormData();
  formData.append("rating", String(payload.rating));
  if (payload.title) formData.append("title", payload.title);
  formData.append("body", payload.body);
  if (payload.visited_on) formData.append("visited_on", payload.visited_on);
  (payload.photos ?? []).forEach((file) => formData.append("photos[]", file));
  const { data } = await api.post<{ data: Review }>(`/destinations/${destinationId}/reviews`, formData);
  return data.data;
};

export const updateReview = async (
  reviewId: number,
  payload: { rating?: number; title?: string | null; body?: string; visited_on?: string | null; photos?: File[]; remove_photo_ids?: number[] },
) => {
  const formData = new FormData();
  formData.append("_method", "put");
  if (payload.rating !== undefined) formData.append("rating", String(payload.rating));
  if (payload.title !== undefined) formData.append("title", payload.title ?? "");
  if (payload.body !== undefined) formData.append("body", payload.body);
  if (payload.visited_on !== undefined) formData.append("visited_on", payload.visited_on ?? "");
  (payload.photos ?? []).forEach((file) => formData.append("photos[]", file));
  (payload.remove_photo_ids ?? []).forEach((id) => formData.append("remove_photo_ids[]", String(id)));
  const { data } = await api.post<{ data: Review }>(`/reviews/${reviewId}`, formData);
  return data.data;
};

export const deleteReview = async (reviewId: number) => {
  await api.delete(`/reviews/${reviewId}`);
};

export const getMyReviews = async (params: Record<string, string | number | undefined> = {}) => {
  const { data } = await api.get<Paginated<Review>>("/reviews/mine", { params });
  return data;
};

export const reportReview = async (reviewId: number, payload: { reason: ReviewReportReason; details?: string | null }) => {
  const { data } = await api.post<{ message: string }>(`/reviews/${reviewId}/report`, payload);
  return data;
};

export interface AdminReviewParams {
  status?: "all" | "visible" | "hidden" | "reported";
  search?: string;
  destination_id?: number;
  page?: number;
  per_page?: number;
}

export const getAdminReviews = async (params: AdminReviewParams = {}) => {
  const { data } = await api.get<Paginated<Review>>("/admin/reviews", { params });
  return data;
};

export const hideAdminReview = async (reviewId: number, reason?: string) => {
  const { data } = await api.post<{ data: Review }>(`/admin/reviews/${reviewId}/hide`, { reason });
  return data.data;
};

export const unhideAdminReview = async (reviewId: number) => {
  const { data } = await api.post<{ data: Review }>(`/admin/reviews/${reviewId}/unhide`);
  return data.data;
};

export const deleteAdminReview = async (reviewId: number) => {
  await api.delete(`/admin/reviews/${reviewId}`);
};