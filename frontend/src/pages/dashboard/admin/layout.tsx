import { Navigate, NavLink, Outlet, useLocation } from "react-router";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/cn";

const adminNav = [
  { to: "/admin/destinations", label: "Destinations", hint: "Create, edit, archive, and restore places." },
  { to: "/admin/reviews", label: "Reviews", hint: "Hide or remove flagged and reported reviews." },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="px-6 py-16 text-sm text-ink-600">Checking your session…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Admin" className="mb-6 -mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2 rounded-2xl bg-sand-100/60 p-1.5 ring-1 ring-line">
            {adminNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.hint}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                    isActive ? "bg-surf-400 text-white shadow-sm" : "text-ink-700 hover:bg-white/70",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
