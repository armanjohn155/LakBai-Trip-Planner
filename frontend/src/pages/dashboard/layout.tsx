import { Navigate, Outlet, useLocation } from "react-router";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";
import { useAuth } from "@/hooks/use-auth";

export default function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="px-6 py-16 text-sm text-ink-600">Checking your session…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}