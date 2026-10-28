/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import { apiError } from "@/lib/api";
import {
  clearReadNotifications,
  deleteNotification,
  getNotificationPreferences,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/lib/notifications";
import type { AppNotification, NotificationPreferences } from "@/lib/notification-types";

const POLL_INTERVAL_MS = 30_000;
const PAGE_SIZE = 10;

type NotificationsContextValue = {
  unreadCount: number;
  items: AppNotification[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<AppNotification | void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearRead: () => Promise<void>;
  loadMore: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const isUnauthorized = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "response" in error &&
  (error as { response?: { status?: number } }).response?.status === 401;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const enabled = Boolean(user);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const mountedRef = useRef(true);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    try {
      const count = await getUnreadNotificationCount();
      if (mountedRef.current) {
        setUnreadCount(count);
      }
    } catch (err) {
      if (isUnauthorized(err)) return;
      if (mountedRef.current) {
        setError(apiError(err));
      }
    }
  }, [enabled]);

  const fetchPage = useCallback(
    async (page: number) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getNotifications({ per_page: PAGE_SIZE, page });
        if (!mountedRef.current) return;
        const current = res.meta?.current_page ?? page;
        const last = res.meta?.last_page ?? current;
        pageRef.current = current;
        setItems((prev) => (current > 1 ? [...prev, ...res.data] : res.data));
        setHasMore(current < last);
      } catch (err) {
        if (isUnauthorized(err)) return;
        if (mountedRef.current) {
          setError(apiError(err));
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([refreshUnreadCount(), fetchPage(1)]);
  }, [enabled, fetchPage, refreshUnreadCount]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading || !hasMore) return;
    await fetchPage(pageRef.current + 1);
  }, [enabled, fetchPage, hasMore, loading]);

  const markRead = useCallback(
    async (id: string) => {
      const previousItems = items;
      const previousCount = unreadCount;
      const target = items.find((item) => item.id === id);

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      if (target && !target.read) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }

      try {
        const updated = await markNotificationRead(id);
        if (mountedRef.current) {
          setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updated, read: true } : item)),
          );
        }
        return updated;
      } catch (err) {
        if (mountedRef.current) {
          setItems(previousItems);
          setUnreadCount(previousCount);
          if (!isUnauthorized(err)) {
            setError(apiError(err));
          }
        }
        throw err;
      }
    },
    [items, unreadCount],
  );

  const markAllRead = useCallback(async () => {
    const previousItems = items;
    const previousCount = unreadCount;

    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch (err) {
      if (mountedRef.current) {
        setItems(previousItems);
        setUnreadCount(previousCount);
        if (!isUnauthorized(err)) {
          setError(apiError(err));
        }
      }
      throw err;
    }
  }, [items, unreadCount]);

  const remove = useCallback(
    async (id: string) => {
      const previousItems = items;
      const previousCount = unreadCount;
      const target = items.find((item) => item.id === id);

      setItems((prev) => prev.filter((item) => item.id !== id));
      if (target && !target.read) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }

      try {
        await deleteNotification(id);
      } catch (err) {
        if (mountedRef.current) {
          setItems(previousItems);
          setUnreadCount(previousCount);
          if (!isUnauthorized(err)) {
            setError(apiError(err));
          }
        }
        throw err;
      }
    },
    [items, unreadCount],
  );

  const clearRead = useCallback(async () => {
    const previousItems = items;
    setItems((prev) => prev.filter((item) => !item.read));
    try {
      await clearReadNotifications();
    } catch (err) {
      if (mountedRef.current) {
        setItems(previousItems);
        if (!isUnauthorized(err)) {
          setError(apiError(err));
        }
      }
      throw err;
    }
  }, [items]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [enabled, refresh, refreshUnreadCount]);

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount: enabled ? unreadCount : 0,
        items: enabled ? items : [],
        loading,
        error,
        hasMore,
        refresh,
        markRead,
        markAllRead,
        remove,
        clearRead,
        loadMore,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider.");
  }
  return context;
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationPreferences();
      setPreferences(data);
    } catch {
      // Preferences are non-critical; keep the last known matrix.
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (updates: Array<{ type: string; channel: string; enabled: boolean }>) => {
      setSaving(true);
      try {
        const data = await updateNotificationPreferences(updates);
        setPreferences(data);
        return data;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetch();
  }, [fetch]);

  return { preferences, loading, saving, fetch, save };
}
