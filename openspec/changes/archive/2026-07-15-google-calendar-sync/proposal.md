# Proposal: google-calendar-sync

## Intent

Store owners manage appointments in the app but have no way to see them in their Google Calendar. This creates friction — they have to manually enter each appointment or context-switch to check availability. This change adds one-way sync (app → Google Calendar) so that confirmed appointments automatically appear as events in the owner's Google Calendar.

## Scope

### In Scope
- Add `googleEventId String?` to Appointment model (new migration)
- Install `googleapis` npm package
- Calendar OAuth service (`src/lib/calendar/oauth.ts`) — OAuth2 client with refresh
- Calendar events service (`src/lib/calendar/events.ts`) — create/update/delete events
- Calendar enable/disable API: `POST /api/stores/[storeId]/calendar` (returns auth URL), `DELETE` to disable, `GET` for status
- OAuth callback: `GET /api/calendar/oauth/callback` — handles Google redirect, stores tokens in CalendarSync
- Calendar sync hooks: fire-and-forget in book route, status-change route, and reschedule route
- Dashboard UI section: toggle to enable/disable calendar sync with status indicator
- New env vars: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`
- Client-side helper at `src/lib/calendar-client.ts` for dashboard API calls

### Out of Scope
- Two-way sync (Google → app) — future enhancement
- Calendar list/picker — uses primary calendar (`"primary"`)
- Webhook for external calendar changes
- Retry queue for failed syncs — logged errors only for MVP
- Calendar event colors/customization
- Batch sync for existing appointments on enable

## Capabilities

### New Capabilities
- `calendar-sync`: One-way sync from Appointments-app to Google Calendar. Covers OAuth credential flow, token refresh, event CRUD, and dashboard management UI.

### Modified Capabilities
- `store-booking`: Booking endpoint now triggers a fire-and-forget calendar event creation after successful appointment creation if the store has CalendarSync enabled. Failure MUST NOT fail the booking.
- `owner-appointments`: Status change to CANCELLED triggers fire-and-forget event deletion. Reschedule triggers event update. Failures are logged only.
- `owner-dashboard`: Dashboard gains a Calendar Sync management section showing enable/disable toggle, connection status, and Google account email.

## Approach

1. **OAuth**: New Google Cloud OAuth 2.0 Client ID with `https://www.googleapis.com/auth/calendar.events` scope. Separate from Auth.js login credentials. Redirect URI: `http://localhost:3000/api/calendar/oauth/callback`.
2. **Token storage**: Uses existing `CalendarSync` model (storeId unique, accessToken, refreshToken, expiryDate, calendarId). CalendarId defaults to `"primary"`.
3. **Calendar service**: Two server-only modules:
   - `src/lib/calendar/oauth.ts` — `getAuthUrl()`, `getTokens()` (exchange code), `refreshAccessToken()`, `isTokenExpired()`. Uses `googleapis` `OAuth2Client`.
   - `src/lib/calendar/events.ts` — `createEvent()`, `updateEvent()`, `deleteEvent()`. All accept `CalendarSync` token data + appointment data. Return the Google event ID.
4. **API routes under `/api/stores/[storeId]/calendar`**:
   - `POST` — create/return auth URL for Google consent (requires owner auth)
   - `GET` — return current CalendarSync status for the store
   - `DELETE` — disconnect (delete CalendarSync record + optionally revoke token)
5. **OAuth callback** (`/api/calendar/oauth/callback`):
   - Exchange `code` for tokens via OAuth2Client
   - Store/update CalendarSync record for the authenticated user's store
   - Return a success page with close/redirect link
6. **Hooks** (fire-and-forget, same pattern as email):
   - `book/route.ts`: after successful creation, if store has CalendarSync, call `createEvent()`
   - `appointments/[id]/route.ts`: on CANCELLED transition, if googleEventId exists, call `deleteEvent()`
   - `reschedule/route.ts`: after successful update, if googleEventId exists, call `updateEvent()`
7. **Dashboard UI**: New Card section below Blocked Dates showing current sync status. Toggle to enable (redirects to Google OAuth consent) or disable (confirmation dialog, disconnects).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `googleapis` dependency |
| `prisma/schema.prisma` | Modified | Add `googleEventId String?` to Appointment |
| `src/lib/calendar/oauth.ts` | New | Google OAuth2 client with token management |
| `src/lib/calendar/events.ts` | New | Calendar event CRUD using googleapis |
| `src/lib/calendar-client.ts` | New | Client-side fetch wrappers for calendar API |
| `src/app/api/stores/[storeId]/calendar/route.ts` | New | Enable/disable/status API |
| `src/app/api/calendar/oauth/callback/route.ts` | New | OAuth callback handler |
| `src/app/api/stores/[storeId]/book/route.ts` | Modified | Add createEvent hook |
| `src/app/api/stores/[storeId]/appointments/[id]/route.ts` | Modified | Add deleteEvent hook |
| `src/app/api/stores/[storeId]/appointments/[id]/reschedule/route.ts` | Modified | Add updateEvent hook |
| `src/app/dashboard/page.tsx` | Modified | Add calendar sync management section |
| `.env.local` | Modified | Add 3 new Google Calendar OAuth env vars |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OAuth access token expiry (1 hour) | High | googleapis OAuth2Client auto-refreshes; concurrent refresh guarded by mutex pattern |
| Refresh token revocation (password change, 6-month inactivity) | Medium | Dashboard detects 401 from Google → shows "Reconnect" state with new auth URL |
| Google Calendar API rate limits (default 1M/day, 60/user/min) | Low | Acceptable for MVP; monitor via logging |
| Fire-and-forget failure invisibility | Medium | Errors logged; dashboard shows last sync status as future enhancement |
| No test infrastructure for OAuth flows | High | Manual testing required for OAuth callback; documented in verify phase |
| Google Cloud Console credential setup friction | Medium | Document exact steps: create OAuth Client ID, enable Calendar API, set redirect URI |

## Rollback Plan

1. Remove calendar hooks from book, status-change, and reschedule routes.
2. Remove calendar API routes and lib files.
3. Drop `googleEventId` column via Prisma migration.
4. Remove `googleapis` from package.json.
5. Delete CalendarSync records (no user data impact — tokens are revocable).
6. No data loss — existing appointments unaffected (field is nullable).

## Dependencies

- `googleapis` npm package
- `GOOGLE_CALENDAR_CLIENT_ID` environment variable
- `GOOGLE_CALENDAR_CLIENT_SECRET` environment variable
- `GOOGLE_CALENDAR_REDIRECT_URI` environment variable (e.g. `http://localhost:3000/api/calendar/oauth/callback`)
- Google Cloud project with Calendar API enabled and OAuth 2.0 Client ID configured

## Success Criteria

- [ ] Owner can enable calendar sync from dashboard → redirected to Google OAuth consent
- [ ] After granting consent, tokens are stored in CalendarSync and sync becomes active
- [ ] New confirmed appointments create a Google Calendar event
- [ ] Cancelling an appointment deletes the corresponding Calendar event
- [ ] Rescheduling an appointment updates the Calendar event date/time
- [ ] Owner can disable calendar sync (deletes CalendarSync record)
- [ ] Calendar API failures do not block appointment booking, status changes, or rescheduling
- [ ] Expired access tokens are refreshed automatically
- [ ] Dashboard shows current sync status (connected/disconnected/error)
