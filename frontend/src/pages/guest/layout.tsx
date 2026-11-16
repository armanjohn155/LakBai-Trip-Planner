import { Outlet, useLocation } from "react-router";

import { Footer } from "@/components/common/footer";
import { Header } from "@/components/common/header";
import { MobileBottomNav } from "@/components/features/home/mobile-bottom-nav";
import { useAuth } from "@/hooks/use-auth";

export default function GuestLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const loggedIn = Boolean(user);
  const isLandingPage = pathname === "/";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Desktop/tablet: site-wide header (always shown). Hidden on mobile. */}
      <div className="hidden md:block">
        <Header />
      </div>

      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />

      {/* Bottom navigation: logged-in users on all pages except the landing page. */}
      {loggedIn && !isLandingPage && <MobileBottomNav />}
    </div>
  );
}
