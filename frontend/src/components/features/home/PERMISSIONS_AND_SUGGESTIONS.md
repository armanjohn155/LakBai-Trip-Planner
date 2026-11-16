# Mobile View Implementation — Permissions & Senior Engineering Suggestions

This document summarizes the reverse-engineered mobile view from the provided design image,
the permissions required to implement it faithfully, and senior-level recommendations
for completing the remaining work.

---

## 1. Design Reverse-Engineering Summary (Right Phone — Logged-in App View)

| UI Element | Image Counterpart | Implementation Status |
|------------|-------------------|----------------------|
| User profile header (avatar + name + location) | Top bar, "Loki Bright · Norway" | ✅ `MobileAppHeader` created |
| Notification bell with badge | Top-right icon | ✅ `MobileAppHeader` (badge = 3) |
| Search bar "Find your place" | Below header | ✅ `MobileAppHeader` (search input) |
| Filter/sliders icon | Search bar right side | ✅ `MobileAppHeader` (not yet wired to filter modal) |
| Filter chips (Europe · Asia · South Africa · ...) | Horizontal scroll row | ✅ `MobileAppHeader` (static chips) |
| "Trending destinations" section + "See all" | Horizontal destination cards | ✅ `TrendingDestinations` component |
| "For you" section + "See all" + nav arrows | Horizontal cards with prev/next | ✅ `ForYouRecommendations` component |
| "Near by you" section + "See all" | 2×2 grid cards | ✅ `NearByYou` component |
| Bottom nav: Home · Booking · Wishlist · Account | 4-tab mobile nav | ✅ Updated `MobileHomeNavigation` |
| Map (full-screen with pins) | Referenced in user request | ✅ Enhanced `DestinationsMapPanel` + `MapPage` |

---

## 2. Permissions Required

### 2.1 Geolocation / Location Permission

**Why needed:** "Use my current location" button on the map, live GPS tracking,
"Near by you" sorting, and check-in verification.

**Current implementation:** `useCurrentLocation()` hook
(`frontend/src/hooks/use-current-location.ts`) handles:
- `navigator.geolocation.getCurrentPosition()` / `watchPosition()`
- Permission denied, timeout, unavailable, insecure-context error states
- Wake Lock API to keep screen on during active tracking
- Accuracy filtering and movement debouncing

**What still needs to be done:**

| Item | Priority | Notes |
|------|----------|-------|
| Explicit permission request UI | High | Currently relies on browser native prompt. Add a custom permission dialog that explains *why* location is needed before calling `start()`. |
| Background location notice | Medium | Wake Lock keeps screen on but does not enable background tracking. Document that location only works while the tab is visible. |
| Permission status persistence | Low | Cache `granted` / `denied` / `prompt` state so we don't re-prompt unnecessarily. |

**Recommended code addition** (in `MobileAppHeader` or map components):

```tsx
const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt">("prompt");

const handleLocationPress = async () => {
  if (locationPermission === "denied") {
    // Show custom dialog directing user to browser site settings
    return;
  }
  const status = await navigator.permissions?.query({ name: "geolocation" });
  // ... handle based on status.state
};
```

---

### 2.2 Notification Permission

**Why needed:** New notification bell in the header, trip updates, arrival alerts,
group tracking presence changes.

**Current implementation:** `use-notifications.tsx` + `NotificationsProvider`
already polls for unread counts and displays a `NotificationBell` component
in the desktop header. The mobile header shows a bell icon but notification
permission is not yet requested.

**What still needs to be done:**

| Item | Priority | Notes |
|------|----------|-------|
| Request notification permission on first bell tap | High | Use `Notification.requestPermission()` and store result. |
| Map notification permission to UI state | High | Show "Notifications off" state in header when permission is denied. |
| Push subscription (optional) | Low | If the backend supports Web Push, subscribe the device token. |

---

### 2.3 Camera / Media Permission

**Why needed:** Trip photo uploads, avatar uploads, review photos.

**Current implementation:** `uploadTripPhoto()` and `uploadAvatar()` in
`frontend/src/lib/api.ts` accept `File` inputs. No camera permission handling
exists yet — users must use the system file picker.

**What still needs to be done:**

| Item | Priority | Notes |
|------|----------|-------|
| Add "Take photo" option alongside file picker | Medium | Requires `navigator.mediaDevices.getUserMedia({ video: true })`. |
| Handle camera permission denied gracefully | Medium | Fall back to file picker with an informative message. |

---

### 2.4 Permission UX Pattern (Recommended)

Create a shared `PermissionGuard` component that wraps any permission-gated
action:

```tsx
interface PermissionGuardProps {
  permission: "geolocation" | "notifications" | "camera";
  children: (status: "granted" | "denied" | "prompt") => ReactNode;
  onRequest: () => Promise<void>;
}
```

This ensures consistent permission UX across the app instead of ad-hoc
browser prompts.

---

## 3. Senior Engineering Suggestions

### 3.1 Component Architecture

**Completed:**
- `MobileAppHeader` — profile, search, filter chips
- `TrendingDestinations` — horizontal scroll cards
- `ForYouRecommendations` — horizontal cards with prev/next nav
- `NearByYou` — 2×2 grid cards
- Updated `MobileHomeNavigation` — Home / Booking / Wishlist / Account tabs
- Enhanced `DestinationsMapPanel` — taller mobile map, location button
- Enhanced `MapPage` — location button, error display

**Suggested next steps:**

| Suggestion | Rationale |
|------------|-----------|
| Extract a shared `DestinationCard` variant for the image-style cards | `TrendingDestinationCard`, `RecommendationCard`, and `NearByCard` share ~80% of markup. Extract to `destination-image-card.tsx` to avoid drift. |
| Add `useMediaQuery("(max-width: 768px)")` for conditional rendering | The `md:hidden` / `md:order-*` approach works, but a React media-query hook gives finer control over mobile-only behavior. |
| Add `react-query` or `swr` for destination data fetching | Current `useEffect` + manual cancelled flag pattern is error-prone. A data-fetching library handles caching, deduping, and background refetching. |
| Add optimistic UI for favorite / add-to-trip actions | Users shouldn't wait for API round-trips to see UI changes. |

### 3.2 Mobile Map Improvements

**Completed:**
- Map height increased from `h-[min(62svh,34rem)]` to `h-[min(72svh,40rem)]`
- Added "Use my current location" button with crosshair/pin toggle
- Added location error display
- `bottomInset` adjusted from 164 to 172 for the taller mobile card

**Suggested next steps:**

| Suggestion | Rationale |
|------------|-----------|
| Add map zoom-to-fit when destination selected | Currently `FlyToDestination` only runs on `focusId`. Add fly-to on `activeId` change too. |
| Add a "My location" marker that persists | Currently live position only shows when GPS is active. Show last known location as a faint marker. |
| Cluster pins at low zoom levels | With 100+ destinations, overlapping pins on mobile are unusable. Use `leaflet.markercluster` or grid-based clustering. |
| Add offline map tile caching | For users in areas with poor connectivity (common for travelers). |

### 3.3 Accessibility (a11y)

| Issue | Current | Recommended |
|-------|---------|-------------|
| Filter chips lack `aria-pressed` | ✅ Added | Ensure screen readers announce selected state |
| Search input has `aria-label` | ✅ | Keep, ensure label is visible or use `aria-labelledby` |
| Bottom nav icons lack text labels on desktop | N/A (mobile-only) | Ensure `aria-label` on each `NavLink` |
| Map location button state not announced | ⚠️ Partially | `aria-label` changes with status; consider `aria-live="polite"` for status changes |
| Color contrast on filter chips | ✅ Uses Tailwind palette | Verify 4.5:1 contrast for small text |

### 3.4 Performance

| Item | Status | Recommendation |
|------|--------|----------------|
| Image lazy loading | ✅ `loading="lazy"` on all images | Add `width`/`height` to prevent layout shift |
| Map re-renders on every destination change | ⚠️ `CebuMap` remounts markers | Wrap markers in `React.memo` or use Leaflet layer groups |
| Bundle size | ⚠️ 887 kB chunk (pre-existing) | Code-split route components; lazy-load map-heavy pages |
| Scroll performance on horizontal lists | ✅ `overflow-x-auto` with `scrollbar-hide` | Add `will-change: transform` to scroll containers |

### 3.5 Error Handling

| Area | Current | Gap |
|------|---------|-----|
| Map tile load failure | ✅ Leaflet handles gracefully | Add fallback map style or offline message |
| Location permission denied | ✅ Error message shown | Add "Open settings" deep link |
| API errors on destination fetch | ✅ `apiError()` + inline error | Add retry button |
| Image load failure | ✅ `onError` hides image | Add placeholder gradient (already done) |

### 3.6 What Remains Unfinished

Based on the codebase review:

1. **Part 3 (Notifications)** — The PART2 report states "Notifications remain Part 3." While notification infrastructure exists (`use-notifications.tsx`, `NotificationsPage`), the mobile header's notification bell is not yet wired to a real notification list or permission flow.

2. **Personalized "For you" recommendations** — Currently passes all destinations. Should eventually use user preferences, visit history, or collaborative filtering.

3. **"Near by you" geolocation sorting** — Currently shows first N destinations. Should sort by distance from `useCurrentLocation()` position.

4. **Filter chips not wired** — The chips in `MobileAppHeader` are static. Connect them to the destination filter API or local state.

5. **Booking tab disabled state** — Shows disabled for logged-out users but no permission prompt or login flow trigger beyond `onClick` prevention.

---

## 4. Recommended Implementation Order

1. **Wire up filter chips** — Connect `MobileAppHeader` filter state to destination filtering
2. **Add location permission dialog** — Before calling `start()`, show a custom explainer
3. **Add notification permission** — Request on bell tap, persist preference
4. **Extract shared destination card** — Reduce duplication between the three card variants
5. **Sort "Near by you" by distance** — Use `useCurrentLocation()` + haversine
6. **Add map clustering** — For 100+ destination pins on mobile
7. **Add optimistic UI** — For favorites and add-to-trip actions

---

## 5. Files Changed / Created

### Created
- `frontend/src/components/features/home/mobile-app-header.tsx`
- `frontend/src/components/features/home/trending-destinations.tsx`
- `frontend/src/components/features/home/for-you-recommendations.tsx`
- `frontend/src/components/features/home/near-by-you.tsx`
- `frontend/src/components/features/home/PERMISSIONS_AND_SUGGESTIONS.md` (this file)

### Modified
- `frontend/src/pages/guest/home/index.tsx` — Integrated new sections, updated nav
- `frontend/src/components/features/home/destinations-map-panel.tsx` — Taller mobile map, location button
- `frontend/src/pages/guest/map.tsx` — Location button on map page
