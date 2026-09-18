import axios from "axios";

import type { AuthPayload, Destination, Itinerary, ItinerarySummary, Paginated, User, UserSettings } from "@/lib/types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000/api";

export const API_ORIGIN = new URL(API_URL).origin;

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
    const message = error.response?.data?.message;
    const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
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

export const getItineraries = async () => {
  const { data } = await api.get<Paginated<Itinerary>>("/itineraries");
  return data.data;
};

export const createItinerary = async (payload: { title: string; start_date?: string | null; end_date?: string | null; budget?: string | number | null }) => {
  const { data } = await api.post<{ data: Itinerary }>("/itineraries", payload);
  return data.data;
};

export const getItinerary = async (id: number) => {
  const { data } = await api.get<{ data: Itinerary }>(`/itineraries/${id}`);
  return data.data;
};

export const updateItinerary = async (id: number, payload: Partial<{ title: string; start_date: string | null; end_date: string | null; budget: string | number | null }>) => {
  const { data } = await api.put<{ data: Itinerary }>(`/itineraries/${id}`, payload);
  return data.data;
};

export const deleteItinerary = async (id: number) => {
  await api.delete(`/itineraries/${id}`);
};

export const getItinerarySummary = async (id: number) => {
  const { data } = await api.get<{ data: ItinerarySummary }>(`/itineraries/${id}/summary`);
  return data.data;
};

export const addItineraryItem = async (itineraryId: number, payload: { destination_id: number; day_number?: number; order?: number; estimated_budget?: number | null; notes?: string | null; visited?: boolean }) => {
  const { data } = await api.post<{ data: Itinerary }>(`/itineraries/${itineraryId}/items`, payload);
  return data.data;
};

export const updateItineraryItem = async (
  itineraryId: number,
  itemId: number,
  payload: Partial<{ destination_id: number; day_number: number; order: number; estimated_budget: number | null; notes: string | null; visited: boolean }>,
) => {
  const { data } = await api.put<{ data: Itinerary }>(`/itineraries/${itineraryId}/items/${itemId}`, payload);
  return data.data;
};

export const deleteItineraryItem = async (itineraryId: number, itemId: number) => {
  await api.delete(`/itineraries/${itineraryId}/items/${itemId}`);
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