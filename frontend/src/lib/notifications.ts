import { api } from "@/lib/api";
import type { Paginated } from "@/lib/types";
import type { AppNotification, NotificationPreferences } from "@/lib/notification-types";

export const getNotifications = async (params: { unread?: boolean; type?: string; per_page?: number } = {}) => {
  const { data } = await api.get<Paginated<AppNotification>>("/notifications", { params });
  return data;
};

export const getUnreadNotificationCount = async () => {
  const { data } = await api.get<{ count: number }>("/notifications/unread-count");
  return data.count;
};

export const markNotificationRead = async (id: string) => {
  const { data } = await api.post<{ data: AppNotification }>(`/notifications/${id}/read`);
  return data.data;
};

export const markAllNotificationsRead = async () => {
  const { data } = await api.post<{ updated: number; count: number }>("/notifications/read-all");
  return data;
};

export const deleteNotification = async (id: string) => {
  await api.delete(`/notifications/${id}`);
};

export const clearReadNotifications = async () => {
  const { data } = await api.delete<{ deleted: number }>("/notifications/read");
  return data;
};

export const getNotificationPreferences = async () => {
  const { data } = await api.get<NotificationPreferences>("/notification-preferences");
  return data;
};

export const updateNotificationPreferences = async (
  preferences: Array<{ type: string; channel: string; enabled: boolean }>,
) => {
  const { data } = await api.put<NotificationPreferences>("/notification-preferences", { preferences });
  return data;
};
