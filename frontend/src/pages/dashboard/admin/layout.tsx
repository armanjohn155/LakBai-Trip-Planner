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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-56 lg:shrink-0">
            <div className="glass rounded-2xl p-3">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">Admin</p>
              <nav className="flex flex-col gap-1">
                {adminNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                        isActive ? "bg-surf-400 text-white" : "text-ink-900 hover:bg-sand-100",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
