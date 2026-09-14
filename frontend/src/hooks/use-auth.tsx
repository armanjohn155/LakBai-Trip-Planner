import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/* The useAuth hook is exported alongside the provider, so fast refresh
   can't reliably hot-swap this module. */
/* eslint-disable react-refresh/only-export-components */

import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem("suroy.user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [loading, setLoading] = useState(() => localStorage.getItem("suroy.token") !== null);

  useEffect(() => {
    const token = localStorage.getItem("suroy.token");
    if (!token) {
      return;
    }
    getMe()
      .then((current) => {
        setUser(current);
        localStorage.setItem("suroy.user", JSON.stringify(current));
      })
      .catch(() => {
        localStorage.removeItem("suroy.token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((store: { user: User; token: string }) => {
    localStorage.setItem("suroy.token", store.token);
    localStorage.setItem("suroy.user", JSON.stringify(store.user));
    setUser(store.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await apiLogin({ email, password });
      persist(payload);
      return payload.user;
    },
    [persist],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const payload = await apiRegister({ name, email, password, password_confirmation: password });
      persist(payload);
      return payload.user;
    },
    [persist],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      localStorage.removeItem("suroy.token");
      localStorage.removeItem("suroy.user");
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((current: User) => {
    localStorage.setItem("suroy.user", JSON.stringify(current));
    setUser(current);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}