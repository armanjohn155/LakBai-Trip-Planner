# Part 2 — Group live route tracking

Laravel 13 / PostgreSQL / Laravel Reverb / Laravel Echo + `pusher-js` / React 19 + Vite.

## Step 0 — Audit

| Area | Finding | Status |
| --- | --- | --- |
| Group membership + policy | `itinerary_user` pivot with `status` (`pending` / `accepted`); `Itinerary::roleFor()` returns a role only for the owner or an **accepted** member; `ItineraryPolicy::view` denies everyone else and the resource layer turns that into a 404. | **DONE** |
| Notification dispatcher | `NotificationDispatcher::tripRecipients()` resolves owner + accepted members, removes the actor and blocked users; `sendToTrip()` is used for arrival notices. `AppNotification` honours in-app/e-mail preferences. | **DONE** |
| Queue driver | `QUEUE_CONNECTION=database` in the current environment; `jobs` table migration exists, so `queue:work` is required. | **DONE** |
| Reverb / broadcasting | `laravel/reverb ^1.13` installed, `config/reverb.php` published, `broadcasting.default = reverb`; `laravel-echo` + `pusher-js` installed; broadcasting auth mounted at `/api/broadcasting/auth` behind `auth:sanctum`. | **DONE** |

No blocking gaps were found; the remaining work was hardening and verification.

## Backend implementation

### Real-time transport

- Private channel `itinerary.{id}.tracking` in `routes/channels.php`.
- Authorization requires all of:
  1. the trip exists and the user is its owner or an accepted member (`roleFor`),
  2. the trip lifecycle is `active`,
  3. the user has an `active` tracking session with `shared_with_group = true`.
- Non-members and pending invitees receive **404** (trip existence does not leak); accepted members who are not opted in, or whose session has ended, receive **403**.
- Broadcasts use `ShouldBroadcastNow`, so no queue lag:
  - `member.location` — `MemberLocationUpdated` (user id, name, avatar, lat/lng, heading/speed, accuracy, recorded_at),
  - `member.sharing` — `MemberSharingChanged`,
  - `member.presence` — `MemberPresenceChanged` (`online: true/false`),
  - `member.arrived` — `MemberArrived`,
  - `meetup.pinned` — `MeetupPinned`.

### Opt-in, cache and throttling

- `tracking_sessions.shared_with_group` defaults to **false**; only the authenticated traveller can toggle their own row. The owner has no endpoint to enable sharing for somebody else.
- Latest position is stored in the cache under `lakbai.tracking.group.{trip}.position.{user}` with a 120 s TTL. Raw pings are still sampled by Part 1 and written to `tracking_points`; latest positions are never a per-ping row.
- Cache store is the application default (`database`) unless `LAKBAI_TRACKING_GROUP_CACHE_STORE` points at Redis.
- `member.location` is throttled atomically with `Cache::add()` once per `group_broadcast_seconds` (5 s), so two concurrent pings cannot both broadcast.
- Presence is derived from the age of the last shared ping (`group_online_seconds = 60`) and swept once a minute.
- Sharing stops automatically after 12 h without a ping (`group_stale_sharing_hours`).

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/itineraries/{itinerary}/tracking/group` | Party roster, shared positions, presence, last seen, distance to next stop, arrived stop, meetup, poll interval. Read throttle `120/min`. |
| `PATCH` | `/api/itineraries/{itinerary}/tracking/sharing` | Toggle **own** sharing on/off. Write throttle `30/min`. |
| `POST` | `/api/itineraries/{itinerary}/tracking/meetup` | Create/replace the "Meet here" pin (lat/lng + 140-char note), expires after 2 h. Write throttle `30/min`. |

Party status is reported per member as `session_status` (`active` / `paused` / `ended`), plus `lifecycle_status` for the trip. Pausing a trip now pauses every member’s session; finishing/cancelling ends every session, so the party list does not show stale "active" rows.

### Group events and notifications

- Arriving at or completing a stop dispatches `MemberArrived` and (when enabled) `MemberArrivedNotification` through `NotificationDispatcher::sendToTrip()`. The actor is always excluded; blocked users are excluded too.
- Arrival notices are suppressed to at most one per trip per 30 min window and contain no e-mail addresses. Broadcast payloads never include e-mail addresses (covered by a test).

### Safety / privacy rules

- Positions are only returned and broadcast while the viewer is **also** sharing. This reciprocal rule is stricter than "accepted members can see sharers"; it is deliberate and tested.
- Non-members get 404; pending members get 404; accepted but opted-out members get 403 on the channel and `null` positions in the endpoint.
- Positions disappear immediately on opt-out, on pause, on finish/cancel, and when a session ends.
- Finish/cancel/expire clear cached positions, meetups and sharing flags. The scheduled `tracking:stop-stale-sharing` covers the 12 h no-ping case.
- No SOS / "I need help" feature was added.

## Frontend implementation

- `useGroupTracking` (`frontend/src/hooks/use-group-tracking.ts`):
  - connects to Echo only when the viewer is sharing and the trip is active,
  - automatically polls `GET .../tracking/group` every 10 s whenever the socket is unavailable, still connecting, or the viewer is not sharing,
  - reconciles state on reconnect (phone lock, tunnel, network change),
  - unsubscribes and unbinds listeners on unmount / sharing off / trip stop,
  - exposes `transport` (`live` / `connecting` / `polling` / `off`) and a realtime status for the indicator.
- `GroupPartyPanel`: visible **"Share my live location with this group"** explanation and switch (off by default), Sharing/Off badge, party list with role, paused badge, online dot, distance to next stop, arrived check, tap-to-center button, meet-pin form and expiry label.
- `TripLiveBar`: `Sharing x/y` indicator plus `Live updates` / `Polling` / `Tracking off` transport chip.
- Map: member markers use avatars when available and initials otherwise, show the member name, fade when the last ping is stale, and use a colour per member distinct from the viewer’s pulse marker. The meetup pin is rendered separately.
- Honest limits copy: locking the phone pauses GPS, so a dot can look frozen or turn gray until the traveller reopens the app.
- `relativeTime()` moved to `src/lib/format.ts` so the panel file only exports components (ESLint fast-refresh rule).

## Files changed in this pass

| File | Change |
| --- | --- |
| `backend/app/Services/GroupTrackingService.php` | Atomic `Cache::add()` broadcast throttle; 5 s window now race-free. |
| `backend/app/Services/TripLifecycleService.php` | Pause/resume now applies to every member’s session, so party status is accurate. |
| `backend/app/Events/MemberLocationUpdated.php` | Optional rounded `heading` / `speed` in the broadcast payload. |
| `backend/app/Http/Requests/TrackingPointsRequest.php` | Validates optional `heading` (0–360). |
| `backend/app/Services/TripTrackingService.php` | Forwards heading/speed to the group layer. |
| `backend/tests/Feature/GroupTrackingTest.php` | Expanded channel matrix, paused/ended status assertions, 16 tests / 185 assertions. |
| `backend/config/reverb.php` | Published Reverb server configuration (new file). |
| `frontend/src/hooks/use-group-tracking.ts` | Heading/speed in live payload merge; distance cleared on opt-out. |
| `frontend/src/hooks/use-trip-tracking.ts` | Sends device heading with GPS points. |
| `frontend/src/lib/types.ts` | Heading/speed, `session_status`, `distance_to_next_stop_m`, `next_stop`. |
| `frontend/src/components/features/map/map-pin.ts` | Avatar-or-initials member markers. |
| `frontend/src/components/features/itinerary/group-party-panel.tsx` | Clear sharing label, pause status, relative-time import. |
| `frontend/src/components/features/itinerary/trip-map-canvas.tsx` | Imports `relativeTime` from the shared format helper. |
| `frontend/src/lib/format.ts` | Shared `relativeTime()` helper. |
| `frontend/src/styles/global.css` | Avatar clipping inside member markers. |

The rest of the feature already lives in the working tree / commit `07c79f6`: group migrations, `GroupTrackingController`, events, `TrackingSession` / `ItineraryMeetup`, commands, `routes/channels.php`, `routes/api.php`, `config/lakbai.php`, schedule entries, `echo.ts`, `trip-live-bar.tsx`, `itinerary-builder.tsx`, and the env examples.

## Channel authorization matrix

| Actor | State | Expected | Covered by test |
| --- | --- | --- | --- |
| Owner | Active trip, sharing | 200 | Yes |
| Editor | Accepted, sharing | 200 | Yes |
| Viewer | Accepted, not opted in | 403 | Yes |
| Viewer | Accepted, opted in | 200 | Yes |
| Owner | Opted out | 403 | Yes |
| Editor | Still sharing after owner opts out | 200 | Yes |
| Pending invitee | Not accepted | 404 | Yes |
| Non-member | No relation to trip | 404 | Yes |
| Sharing member | Session ended | 403 | Yes |
| Sharing member | Trip paused/completed | 403 | Yes |

## Windows commands

Backend (from `backend/`):

```powershell
php artisan migrate
php artisan serve
php artisan reverb:start
php artisan queue:work
php artisan schedule:work
```

Frontend (from `frontend/`):

```powershell
npm run dev
```

Required local settings (already in the env examples):

```dotenv
BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database
CACHE_STORE=database

REVERB_APP_ID=...
REVERB_APP_KEY=lakbai-local-key
REVERB_APP_SECRET=...
REVERB_HOST=localhost
REVERB_PORT=6001
REVERB_SCHEME=http
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=6001
```

```dotenv
VITE_REVERB_APP_KEY=lakbai-local-key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=6001
VITE_REVERB_SCHEME=http
```

`reverb:start` handles WebSockets, `queue:work` handles queued notifications/jobs, and `schedule:work` runs `tracking:sweep-presence` (every minute) and `tracking:stop-stale-sharing` (every 10 minutes).

## Verification

Automated, against the committed in-memory SQLite test config (`backend/phpunit.sqlite.xml`):

```powershell
cd backend
vendor/bin/phpunit -c phpunit.sqlite.xml tests/Feature/GroupTrackingTest.php
# 16 tests, 185 assertions — passed

vendor/bin/phpunit -c phpunit.sqlite.xml `
  tests/Feature/GroupTrackingTest.php `
  tests/Feature/TripTrackingTest.php `
  tests/Feature/TripLifecycleTest.php `
  tests/Feature/TripStopFlowTest.php `
  tests/Feature/NotificationTest.php `
  tests/Feature/ItinerarySharingTest.php `
  tests/Feature/TripRescheduleAndExpiryTest.php
# 86 tests, 590 assertions — passed

vendor/bin/pint --dirty --format agent   # passed
```

Frontend:

```powershell
cd frontend
npm run lint    # clean
npm run build   # success (tsc -b + vite build; only the existing >500 kB chunk warning)
```

The default `phpunit.xml` targets a local PostgreSQL `lakbai_test` on `127.0.0.1:5432`, which is not installed in this environment. Tests were therefore run with the repository’s committed SQLite config. No destructive database command was run, and no production/shared database was touched.

### Not verified manually

The two-browser exercise (normal + incognito, DevTools Sensors, moving markers, opt-out hiding, arrival toast) was **not** performed here. It needs two authenticated accounts and geolocation emulation against a disposable database; this machine has no local PostgreSQL and the configured database is remote/shared, so using it would have written test accounts and trips into non-disposable data. The channel matrix, opt-in/opt-out, throttling, cache clearing, polling scoping, arrival event, notification actor exclusion and e-mail-free payloads are covered by the feature tests instead.

## Assumptions and conflicts

- **Presence naming:** the requirement mentions `member.online` / `member.offline`; the implementation broadcasts one `member.presence` event with `online: true|false`. This is behaviourally equivalent and the client handles both transitions.
- **Reciprocal visibility:** accepted members only see other positions while they themselves are sharing. This is stricter than the minimum wording and intentionally privacy-first.
- **Pause semantics:** pausing a trip now pauses all members’ sessions. This changes Part 1 behaviour slightly, but keeps the party list truthful; resuming reactivates those sessions without re-enabling sharing.
- **Heading/speed:** optional values are rounded before broadcast and omitted when absent; older clients ignore them.
- **Notification batching:** group arrival notices use a per-trip 30-minute cache window rather than the generic `trip.updated` row-merging path.
- **Security note:** `backend/.env.example` (already committed before this work) contains a database URL with embedded credentials. It should be rotated and removed from the example file. No secret values are repeated in this report.
