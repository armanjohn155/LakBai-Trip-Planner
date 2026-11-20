import { Navigate, Outlet, useLocation } from "react-router";
import { twMerge } from "tailwind-merge";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";
import { useAuth } from "@/hooks/use-auth";

export default function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPlanner = /^\/app\/trips\/[^/]+$/.test(location.pathname) && location.pathname !== "/app/trips/new";

  if (loading) {
    return <p className="px-6 py-16 text-sm text-ink-600">Checking your session…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className={twMerge("flex min-h-dvh flex-col", isPlanner && "h-dvh overflow-hidden")}>
      <Header />
      <main
        className={twMerge(
          isPlanner
            ? "min-h-0 flex-1"
            : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-[calc(var(--bottom-nav-h)+2rem)] sm:px-6 sm:py-10 md:pb-10",
        )}
      >
        <Outlet />
      </main>
      {isPlanner ? null : <Footer className="pb-[calc(var(--bottom-nav-h)+1rem)] md:pb-0" />}
    </div>
  );
}
