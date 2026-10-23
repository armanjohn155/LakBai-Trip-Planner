# Part 2 - Trips with friends

## Scope

Solo/group trips, accept-only friend invitations, owner/editor/viewer permissions,
invite-link fallback, pending-invite privacy, version conflicts, shared-budget
visibility, activity history and polling UI.

## Requirement audit

| Requirement | Implementation | Status |
| --- | --- | --- |
| Create solo or group trips | `trip_type` in `StoreItineraryRequest`, `TripDraft`, wizard toggle, grouped review card | Done |
| Group trip flips on first accepted member | `Itinerary::syncTripType()` called from `TripInvitationService` accept/remove/leave/link paths | Done |
| Invite accepted friends only | `ItineraryInviteController` + `TripInvitationService::invite`, friend picker in wizard and share modal | Done |
| Owner-only member management | `ItineraryPolicy::manageMembers`, route middleware, share modal gating | Done |
| Editor can edit but not manage members | Policy gates on `update` vs `manageMembers`; builder hides settings/member controls for viewers | Done |
| Viewer read-only + export + duplicate | `ItineraryPolicy`, builder role gating, export/duplicate endpoints | Done |
| Pending invitee sees preview only | `ItineraryPendingInviteResource`, `ItineraryController@index?filter=invited`, `/invitation` endpoint | Done |
| Non-members and admins get no private access | `scopeAccessibleBy`, policies, route binding using accepted pivot status | Done |
| Blocked users cannot invite/join | `TripInvitationService` block checks in email/link/pending paths | Done |
| Invite links are fallback, revocable, limited | `InviteLinkController`, `ItineraryInviteResource`, share modal link tab | Done |
| Link tokens stored hashed | SHA-256 in existing `itinerary_invites.token` column (name is legacy) | Done |
| share_budget hides money from viewers | `ItineraryResource`, item resource, PDF/ICS/GPX exporters, budget summary private state | Done |
| Optimistic concurrency with 409 | `ItineraryConflictGuard`, `base_version` on writes, conflict dialog preserving editor text | Done |
| Activity history | `itinerary_activities`, `ItineraryActivityLogger`, `/changes`, `/activities`, activity modal | Done |
| Group polling | 25-second `/changes` polling, refresh banner, view-activity action | Done |
| Trips list filters + pending invites | All / Mine / Shared / Invitations filters, Accept/Decline cards, group badges and avatars | Done |
| Invite landing page | Group-aware card, role/member/expiry details, post-accept friend request | Done |

## Changed files

### Backend

- `backend/app/Http/Controllers/Api/ItineraryController.php`
- `backend/app/Http/Controllers/Api/ItineraryInviteController.php`
- `backend/app/Http/Controllers/Api/ItineraryInviteAcceptController.php`
- `backend/app/Http/Controllers/Api/ItineraryMemberController.php`
- `backend/app/Http/Controllers/Api/InviteLinkController.php`
- `backend/app/Http/Controllers/Api/ItineraryExportController.php`
- `backend/app/Http/Resources/ItineraryPendingInviteResource.php` (new)
- `backend/app/Http/Resources/ItineraryResource.php`
- `backend/app/Http/Resources/ItineraryItemResource.php`
- `backend/app/Models/Itinerary.php`
- `backend/app/Models/ItineraryItem.php`
- `backend/app/Models/ItineraryInvite.php`
- `backend/app/Policies/ItineraryPolicy.php`
- `backend/app/Policies/ItineraryItemPolicy.php`
- `backend/app/Services/TripInvitationService.php`
- `backend/app/Services/ItineraryConflictGuard.php`
- `backend/app/Services/ItineraryActivityLogger.php`
- `backend/app/Services/Export/PdfExporter.php`
- `backend/app/Services/Export/IcsExporter.php`
- `backend/app/Services/Export/GpxExporter.php`
- `backend/app/Events/Trip*.php`
- `backend/routes/api.php`
- `backend/routes/console.php`
- `backend/resources/views/exports/itinerary.blade.php`
- `backend/tests/Feature/ItinerarySharingTest.php` (new, 15 tests)

### Frontend

- `frontend/src/lib/types.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/trip-draft.ts`
- `frontend/src/components/features/sharing/friend-picker.tsx` (new)
- `frontend/src/components/features/itinerary/share-dialog.tsx` (new)
- `frontend/src/components/features/itinerary/itinerary-builder.tsx`
- `frontend/src/components/features/itinerary/trip-card.tsx`
- `frontend/src/components/features/itinerary/stop-card.tsx`
- `frontend/src/components/features/itinerary/stop-editor.tsx`
- `frontend/src/components/features/itinerary/budget-summary.tsx`
- `frontend/src/components/features/trip-wizard/details-step.tsx`
- `frontend/src/components/features/trip-wizard/review-step.tsx`
- `frontend/src/pages/dashboard/user/trip-wizard.tsx`
- `frontend/src/pages/dashboard/user/trips.tsx`
- `frontend/src/pages/invite/accept.tsx`

## Permission matrix

| Action | Owner | Editor | Viewer | Pending invitee | Non-member / admin |
| --- | --- | --- | --- | --- | --- |
| View trip | Yes | Yes | Yes | Preview only | No (404) |
| Edit details / stops / reorder | Yes | Yes | No | No | No |
| Export | Yes | Yes | Yes | No | No |
| Duplicate | Yes | Yes | Yes | No | No |
| Invite / remove members | Yes | No | No | No | No |
| Change roles / transfer ownership | Yes | No | No | No | No |
| Create / revoke links | Yes | No | No | No | No |
| RSVP / leave trip | Yes (no leave) | Yes | Yes | No | No |
| See budget | Yes | Yes | Only when `share_budget=true` | No | No |

## Trip events

- `TripInviteSent`
- `TripInviteAccepted`
- `TripInviteDeclined`
- `TripMemberJoinedViaLink`
- `TripMemberRemoved`
- `TripMemberLeft`
- `TripMemberRoleChanged`
- `TripOwnershipTransferred`
- `TripUpdated`
- `TripDeleted`

Notifications remain Part 3; this part only dispatches events and writes activity.

## Version conflicts

- All mutating endpoints accept optional `base_version`.
- `ItineraryConflictGuard` returns HTTP 409 with `conflict: true`, fresh `data`,
  and the affected `stop` when applicable.
- Builder/stop editor send `base_version`; the UI shows a conflict dialog with
  **Keep editing** and **Load latest version**. Unsaved form text remains mounted.
- Group polling uses `GET /itineraries/{id}/changes?since_version=N` every 25s
  and shows a refresh banner instead of silently replacing local edits.

## Two-account walkthrough

1. **Account A** adds **Account B** as an accepted friend.
2. A creates a group trip, picks B from the friend picker, role `editor`.
3. B sees the trip under **Invitations**, accepts, and the trip moves to **All/Mine/Shared**.
4. B opens the planner, adds a stop; `version` increments and activity records the edit.
5. A keeps the planner open; within 25s the refresh banner names B and offers **View activity**.
6. A and B edit the same stop; the second save gets 409 and a conflict dialog.
7. A opens **Share**, changes B to viewer; B's builder becomes read-only.
8. A toggles **Show budget to viewers** off; B's budget card shows **Private**.
9. A creates a view-only share link; a third account accepts it and joins as viewer.
10. B leaves; trip type remains group while other accepted members remain.

## Commands and results

```text
php artisan test --compact tests/Feature/ItinerarySharingTest.php
15 passed, 110 assertions.

php artisan test --compact tests/Feature/ItinerarySharingTest.php \
  tests/Feature/ItineraryControllerTest.php tests/Feature/ItineraryPolicyTest.php \
  tests/Feature/ItineraryItemControllerTest.php tests/Feature/ItineraryItemPolicyTest.php \
  tests/Feature/ItineraryExportTest.php tests/Feature/ItineraryDuplicateTest.php \
  tests/Feature/ItineraryBudgetTest.php tests/Feature/NotificationTest.php
76 passed, 312 assertions.

npm run build
Passed (Vite chunk-size warning only).

npm run lint
Passed.

./vendor/bin/pint <changed PHP files>
Passed; formatting applied.
```

## Assumptions

- `itinerary_invites.token` stores a SHA-256 hash even though the column is not
  named `token_hash`; renaming it is deferred to avoid a schema break.
- Pending invitees do not make a trip `group`; only accepted members do.
- Admins have no implicit access to private trips.
- Polling, not WebSockets, is the group-update mechanism.
- Owners must transfer ownership before leaving; the UI hides **Leave** for owners.
- Duplicated trips copy stops but never members, invites or activity.

## Known limitations / conflicts

- Full backend suite still has pre-existing unrelated failures: one
  `AuthControllerTest` credential-seeder failure and four missing-GD upload errors.
- Docker/MySQL migration is still pending credentials and approval; local tests
  and the app use SQLite.
- Vite reports an 887 kB bundle chunk; code-splitting is not part of Part 2.
- Viewer stop titles open the map focus rather than a dedicated read-only stop
  detail modal; notes and estimates remain visible on the stop card.
- Repository hygiene: several Part 2 files were already staged/modified before
  this work, and `frontend/src/components/common/header.tsx` has a staged
  conflict-marker version with a resolved working tree. No commit was made.
