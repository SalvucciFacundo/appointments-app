# Tasks: google-calendar-sync

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-550 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

## Phase 1: Foundation

- [ ] 1.1 Run `npm install googleapis` in project root
- [ ] 1.2 Add `googleEventId String?` to Appointment in `prisma/schema.prisma`, then run `npx prisma db push`
- [ ] 1.3 Add `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` to `.env.local`

## Phase 2: Calendar Service

- [ ] 2.1 Create `src/lib/calendar/oauth.ts` — `getAuthUrl()`, `getTokens(code)`, `refreshAccessToken(refreshToken)`, `isTokenExpired(expiryDate)`. Uses `googleapis` `OAuth2Client` with the Calendar events scope.
- [ ] 2.2 Create `src/lib/calendar/events.ts` — `createEvent(calendarSync, appointment)`, `updateEvent(calendarSync, appointment)`, `deleteEvent(calendarSync, googleEventId)`. Each refreshes token if expired, then calls the Google Calendar API.

## Phase 3: API Routes

- [ ] 3.1 Create `src/app/api/stores/[storeId]/calendar/route.ts` — `POST` returns OAuth auth URL, `GET` returns CalendarSync status, `DELETE` deletes CalendarSync record. All guarded by `assertOwnerAccess`.
- [ ] 3.2 Create `src/app/api/calendar/oauth/callback/route.ts` — reads `code` query param, exchanges for tokens via OAuth2Client, upserts CalendarSync record for the authenticated user's store, returns success page.

## Phase 4: Sync Hooks

- [ ] 4.1 Add fire-and-forget `createEvent` hook in `src/app/api/stores/[storeId]/book/route.ts` — after appointment creation, if store has CalendarSync, create Google event and update `appointment.googleEventId` (no await on the caller).
- [ ] 4.2 Add fire-and-forget `deleteEvent` hook in `src/app/api/stores/[storeId]/appointments/[id]/route.ts` — on CANCELLED transition, if `appointment.googleEventId` exists, delete the Google event.
- [ ] 4.3 Add fire-and-forget `updateEvent` hook in `reschedule/route.ts` — after successful dateTime update, if `appointment.googleEventId` exists, update the Google event's start/end time.

## Phase 5: Dashboard UI

- [ ] 5.1 Create `src/lib/calendar-client.ts` — client-side fetch wrappers: `enableCalendar(storeId)`, `getCalendarStatus(storeId)`, `disableCalendar(storeId)`.
- [ ] 5.2 Add Calendar Sync section to `src/app/dashboard/page.tsx` — Card with enable button (redirects to Google OAuth), status indicator (connected/disconnected), and disable button with confirmation.

## Phase 6: Verify

- [ ] 6.1 Run `npx tsc --noEmit` — fix any type errors
- [ ] 6.2 Run `npm run build` — verify production build succeeds
