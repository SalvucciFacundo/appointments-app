# Improvement Tasks

Prioritized portfolio improvements for Appointments-app.

## Priority 1 — Foundation

### 1.1 Test Suite (Vitest)

- [ ] Install Vitest + @testing-library/react
- [ ] Unit tests for `src/lib/slots.ts` — `getAvailableSlots()` edge cases (cross-midnight, blocked dates, capacity, timezone)
- [ ] Unit tests for status state machine in appointments API
- [ ] Unit tests for `src/lib/management-link.ts` — token generation + URL building
- [ ] Integration test for booking endpoint (mocked DB)
- [ ] Integration test for cron reminder endpoint (mocked Resend)
- [ ] Configure CI to run tests on push

### 1.2 Rate Limiting (Anonymous Booking)

- [ ] Install or implement in-memory rate limiter
- [ ] Apply rate limit to POST /api/stores/[storeId]/book (anonymous only)
- [ ] Return 429 with Retry-After header when exceeded
- [ ] Apply rate limit to POST /api/reviews (authenticated, per-user)
- [ ] Verify via build + test

### 1.3 Google Calendar — Expired Token Handling

- [ ] Add `lastSyncError String?` field to CalendarSync model
- [ ] Detect 401 from Google Calendar API in events.ts → store error message
- [ ] Expose error status in GET /api/stores/[storeId]/calendar response
- [ ] Show reconnection warning in dashboard calendar section
- [ ] Verify via build

## Priority 2 — UX & Scale

### 2.1 Pagination

- [ ] Add cursor/page params to GET /api/stores/public
- [ ] Add pagination to GET /api/admin/stores
- [ ] Add pagination to GET /api/admin/reviews
- [ ] Add pagination to GET /api/stores/[storeId]/appointments
- [ ] Add load-more or page controls in UI components (landing, admin, dashboard)
- [ ] Verify via build

### 2.2 Persistent Dark Mode

- [ ] Add localStorage toggle in layout
- [ ] Persist preference across sessions
- [ ] Respect system preference as default (current behavior)
- [ ] Add sun/moon toggle button in header
- [ ] Verify persistence across page reloads

### 2.3 Two-Way Google Calendar Sync

- [ ] Implement Push Webhook endpoint (POST /api/calendar/webhook)
- [ ] Register webhook with Google Calendar API on sync activation
- [ ] Handle sync events: event updated/deleted → update Appointment
- [ ] Test with manual Google Calendar changes

## Priority 3 — Portfolio Polish

### 3.1 Interactive Charts

- [ ] Install Recharts
- [ ] Replace stat cards in dashboard analytics with bar chart (appointments by hour)
- [ ] Add line chart (appointments over last 30 days)
- [ ] Replace stat cards in admin global metrics with mini charts
- [ ] Verify build + dark mode compatibility

---

## Execution Order

1. Tests first (Vitest) — everything else is easier to verify with tests
2. Rate limiting — quick win, security gap
3. Google Calendar error handling — small change
4. Then Priority 2 in any order (independent)
5. Charts last (pure UI, no logic changes)
