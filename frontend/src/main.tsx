import "@/styles/global.css";
import "leaflet/dist/leaflet.css";

/* The destinations redirect is defined alongside the route tree, so fast
   refresh can't reliably hot-swap this module. */
/* eslint-disable react-refresh/only-export-components */

import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";

import { FavoritesTab } from "@/components/features/profile/favorites-tab";
import { ProfileSummaryTab } from "@/components/features/profile/profile-summary-tab";
import { SettingsTab } from "@/components/features/profile/settings-tab";
import { TripsTab } from "@/components/features/profile/trips-tab";
import { AuthProvider } from "@/hooks/use-auth";
import { FavoritesProvider } from "@/hooks/use-favorites";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import AdminPage from "@/pages/dashboard/admin";
import AppLayout from "@/pages/dashboard/layout";
import DestinationDetailPage from "@/pages/dashboard/user/destination-detail";
import DestinationsPage from "@/pages/dashboard/user/destinations";
import FavoritesPage from "@/pages/dashboard/user/favorites";
import DashboardHomePage from "@/pages/dashboard/user/home";
import ItineraryPage from "@/pages/dashboard/user/itinerary";
import ProfilePage from "@/pages/dashboard/user/profile";
import TripsPage from "@/pages/dashboard/user/trips";
import TripWizardPage from "@/pages/dashboard/user/trip-wizard";
import AboutPage from "@/pages/guest/about";
import ContactPage from "@/pages/guest/contact";
import GuestLayout from "@/pages/guest/layout";
import HomePage from "@/pages/guest/home";
import MapPage from "@/pages/guest/map";
import PublicPageLayout from "@/pages/guest/page-layout";

function DestinationDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/destinations/${id}`} replace />;
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <FavoritesProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>

          <Route element={<PublicPageLayout />}>
            <Route path="destinations" element={<DestinationsPage />} />
            <Route path="destinations/:id" element={<DestinationDetailPage />} />
          </Route>

          <Route path="map" element={<MapPage />} />

          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* Declared before the /app layout so stale dashboard destination URLs
              never hit AppLayout's auth guard — guests land straight on the
              public destination pages. */}
          <Route path="app/destinations" element={<Navigate to="/destinations" replace />} />
          <Route path="app/destinations/:id" element={<DestinationDetailRedirect />} />

          <Route path="app" element={<AppLayout />}>
            <Route index element={<DashboardHomePage />} />
            <Route path="trips" element={<TripsPage />} />
            <Route path="trips/new" element={<TripWizardPage />} />
            <Route path="trips/:id" element={<ItineraryPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="profile" element={<ProfilePage />}>
              <Route index element={<ProfileSummaryTab />} />
              <Route path="trips" element={<TripsTab />} />
              <Route path="favorites" element={<FavoritesTab />} />
              <Route path="settings" element={<SettingsTab />} />
            </Route>
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="trips" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </FavoritesProvider>
  </AuthProvider>,
);