## Exploration: google-calendar-sync

### Current State

The application manages appointments end-to-end but has **zero Google Calendar integration**:

- **Prisma schema**: `CalendarSync` model exists with `id`, `storeId` (unique→Store), `accessToken`, `refreshToken`, `expiryDate`, `calendarId` — all fields needed for OAuth token storage and calendar reference.
- **Appointment model**: Has `status` enum (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`), `dateTime`, `clientName`, `clientPhone`, `clientEmail`, `service`, `notes`, `managementToken` — but **no `googleEventId` field** to track the linked Google Calendar event.
- **Auth system**: Auth.js v5 with Google provider — configured for **login only** (no calendar scopes). The existing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env.local` are for OpenID Connect login.
- **API route pattern**: `stores/[storeId]/subresource` routes with `assertOwnerAccess(storeId)` guard. Fire-and-forget async hooks demonstrated in `appointments/[id]/route.ts` (sends cancellation email).
- **Status transitions**: `PENDING→CONFIRMED|CANCELLED`, `CONFIRMED→COMPLETED|CANCELLED`. Reschedule via `appointments/[id]/reschedule` with full slot validation.
- **Dashboard** (`dashboard/page.tsx`): Client component with Store Info, Business Hours, Slot Settings, Blocked Dates, then appointments sections (PendingQueue, TodayAgenda, DayCalendar, AppointmentDetail). No calendar sync UI.
- **No `googleapis` package** in `package.json`.

### Affected Areas

- `prisma/schema.prisma` — Add `googleEventId String?` to `Appointment` model
- `package.json` — Add `googleapis` dependency (or use raw REST)
- `src/lib/calendar.ts` — **NEW**: Google Calendar service (token refresh, event CRUD)
- `src/app/api/calendar/auth/route.ts` — **NEW**: Redirect to Google OAuth consent (calendar scopes)
- `src/app/api/calendar/oauth/callback/route.ts` — **NEW**: Handle OAuth callback, store tokens in CalendarSync
- `src/app/api/calendar/status/route.ts` — **NEW**: GET current sync status for the owner's store
- `src/app/api/calendar/disconnect/route.ts` — **NEW**: DELETE CalendarSync record
- `src/lib/calendar-client.ts` — **NEW**: Client-side fetch wrappers for calendar API
- `src/app/dashboard/page.tsx` — Add Calendar Sync toggle section
- `src/app/api/stores/[storeId]/appointments/[id]/route.ts` — Hook: CREATE event on CONFIRMED, DELETE/UPDATE on CANCELLED
- `src/app/api/stores/[storeId]/appointments/[id]/reschedule/route.ts` — Hook: UPDATE event dateTime
- `src/app/api/stores/[storeId]/book/route.ts` — Hook: CREATE event if store has sync AND appointment is CONFIRMED
- `.env.local` — Add `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` (separate OAuth client for calendar scopes), `GOOGLE_CALENDAR_REDIRECT_URI`
- `src/types/calendar.ts` — **NEW**: Calendar-related TypeScript types

### Approaches

#### 1. Google API Client — `googleapis` npm package vs. Direct REST

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A: googleapis** | Built-in token refresh, strongly typed, official maintainer | Heavy (~500KB unminified), another dependency, overkill if we only use Calendar API | Low for impl, Medium for bundle |
| **B: Direct REST** | Zero dependencies, lightweight, full control over requests | Must implement token refresh manually, more boilerplate for auth headers and error parsing | Medium |

**Recommendation**: **Option A — `googleapis`**. The token refresh cycle (access token expires in 1 hour, refresh token is long-lived) is the trickiest part of the Calendar integration. `googleapis` handles this transparently with `OAuth2Client`. The bundle size concern is negligible because this code runs server-side only (API routes) — it never hits the client bundle. Import it only in server modules.

#### 2. Calendar Sync Trigger — Proactive vs. Reactive

**Option A: Hook into existing routes** (fire-and-forget after DB write)
- Same pattern as email: after the appointment status changes / reschedules, call a fire-and-forget `syncCalendarEvent()` function
- Pros: No new infrastructure, consistent with existing pattern
- Cons: If the event creation fails, the appointment is already saved — requires error logging + manual retry

**Option B: Database trigger / Webhook / Queue**
- Pros: Reliable, retry logic, decoupled
- Cons: Over-engineered for MVP, no queue infrastructure exists

**Recommendation**: **Option A** — same fire-and-forget pattern used for cancellation emails. If the Google API call fails, log the error and move on. MVP can add a "Re-sync" button in the dashboard later.

#### 3. OAuth Client — Separate from Auth.js vs. Reuse existing Google Provider

**Option A: Separate OAuth client** (new Google Cloud credentials with calendar scope)
- Create a second OAuth 2.0 Client ID in Google Cloud Console with `https://www.googleapis.com/auth/calendar.events` scope
- Auth.js login OAuth stays with `openid profile email` scopes
- Pros: Clean separation of concerns, calendar doesn't need Auth.js integration, lower blast radius (compromised calendar token doesn't affect login)
- Cons: User sees two Google consent screens (one for login, one for calendar)

**Option B: Extend Auth.js Google provider with calendar scopes**
- Pros: Single OAuth flow, single client ID
- Cons: Auth.js Google provider may not expose raw OAuth tokens for arbitrary scopes; the provided `access_token` is for login, not for Calendar API; mixing scopes complicates the Auth.js flow

**Recommendation**: **Option A — Separate OAuth client**. Auth.js owns authentication; the Calendar OAuth is a separate integration. The user seeing two consent screens is the expected UX pattern for apps that need calendar access after login. The separate client ID also means:
- Different redirect URIs: `http://localhost:3000/api/calendar/oauth/callback` vs `http://localhost:3000/api/auth/callback/google`
- Calendar tokens stored in our DB (CalendarSync), not in Auth.js Account model
- Token refresh is our responsibility, handled by `googleapis` OAuth2Client

#### 4. Calendar ID — Primary vs. Dedicated secondary calendar

**Option A: Use the primary calendar** (`calendarId: "primary"`)
- Pros: No calendar creation needed, events appear in the user's main calendar
- Cons: Clutters the user's primary calendar

**Option B: Create a secondary calendar** (e.g., "Turnos — {storeName}")
- Pros: Clean separation, can delete/disable without affecting user's personal calendar
- Cons: Requires additional API call to create the calendar, need write scope for calendar metadata

**Recommendation**: **Option A for MVP** — use `"primary"`. The store owner explicitly wants these events synced. Users can move events to a different calendar manually if desired. The `calendarId` field on `CalendarSync` is already nullable and can hold a secondary calendar ID if we add that feature later.

### Sequence: Appointment CONFIRMED → Calendar Event Created

```
Owner Dashboard             API: status change           CalendarSync          Google Calendar
      │                              │                       │                       │
      │── CONFIRM {appointmentId} ──→│                       │                       │
      │                              │── update status ─────→│                       │
      │                              │←── appointment ──────│                       │
      │                              │                       │                       │
      │                              │── find CalendarSync ─→│                       │
      │                              │←── tokens ───────────│                       │
      │                              │  (if exists)          │                       │
      │                              │                       │                       │
      │                              │── refresh if expired ──────────────────────→│
      │                              │←── fresh token ────────────────────────────│
      │                              │                       │                       │
      │                              │── POST /calendars/primary/events ─────────→│
      │                              │←── { eventId } ────────────────────────────│
      │                              │                       │                       │
      │                              │── update Appointment.googleEventId ───────→│
      │                              │                       │                       │
      │←── 200 { appointment } ────│                       │                       │
```

### Schema Delta

```prisma
model Appointment {
  // ...existing fields...
  googleEventId String?   // Google Calendar event ID for sync tracking
}
```

### Recommendation Summary

| Component | Choice | Why |
|-----------|--------|-----|
| API Client | `googleapis` npm package | Built-in OAuth2 token refresh, server-only import |
| Trigger Pattern | Fire-and-forget in existing routes | Same as email hooks, no new infra |
| OAuth Client | New Google Cloud OAuth client with calendar scopes | Separate from Auth.js login, different redirect URI |
| Calendar | Primary calendar (`"primary"`) | Simplest, user opted-in explicitly |
| Schema Change | Add `googleEventId` to Appointment | Minimal, nullable, stores the reference for updates/deletes |
| Token Storage | `CalendarSync` model (existing) | Already has all fields needed |

### Risks

1. **OAuth token expiry**: Access tokens expire after 1 hour. The refresh mechanism in `googleapis` `OAuth2Client` must handle concurrent refresh attempts gracefully — use a mutex/lock pattern if two requests try to refresh simultaneously.

2. **Refresh token revocation**: Google may revoke refresh tokens if the user changes their password, removes the app from their Google account, or if the refresh token hasn't been used for 6 months. The UI must handle this gracefully (show "Reconnect Google Calendar" state).

3. **No test infrastructure**: Like the rest of the project, no test runner is configured. Calendar OAuth callback handling and token refresh logic would benefit greatly from tests.

4. **Rate limits**: Google Calendar API has quotas (default 1,000,000 queries per day, 60 queries per user per 60 seconds). For a small store with dozens of appointments/day this is fine, but worth logging for observability.

5. **Fire-and-forget failure visibility**: If calendar event creation/update/delete fails silently (logged only), the store owner won't know. Consider a visual indicator in the dashboard (e.g., "Last sync failed — retry").

6. **Next.js 16.2.10 Route Handler params**: Already confirmed — `params` is a Promise, existing routes use `const { storeId } = await params`. The new calendar routes (`/api/calendar/oauth/callback`) don't use route params so this is not a concern.

7. **Appointment creation via booking API**: When a client books and the appointment is created as CONFIRMED (authenticated user) or later CONFIRMED by the owner, both paths must trigger sync. The book route and the status-change route both need calendar hooks.

8. **Refresh token in CalendarSync vs. Account model**: The CalendarSync model stores its OWN refresh token (from the calendar OAuth flow), NOT the one from Auth.js login. Must not confuse the two — they come from different OAuth clients and have different scopes.

### Ready for Proposal

Yes. The exploration resolves all key questions:

- **`googleapis` npm package** — confirmed as the right choice (server-only, token refresh support)
- **Separate OAuth client** — confirmed necessary (Auth.js login scope ≠ calendar scope)
- **`googleEventId` on Appointment** — confirmed as the minimal schema addition for tracking
- **Fire-and-forget hook pattern** — confirmed consistent with existing email hooks
- **Dashboard placement** — confirmed: new Card section between Blocked Dates and appointments, following the existing section pattern
- **OAuth callback route** — confirmed: `/api/calendar/oauth/callback` with separate redirect URI
- **API routes needed**: auth (redirect to consent), callback (token exchange), status (GET), disconnect (DELETE)
- **New env vars**: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`
