# Improvement Tasks

Prioritized portfolio improvements for Appointments-app.

## Priority 1 — Foundation

### 1.1 Test Suite (Vitest)

- [x] Install Vitest
- [x] Unit tests for `src/lib/slots.ts` — `getAvailableSlots()` edge cases
- [x] Unit tests for validators (`validateTimeFormat`, `validateDayOfWeek`, `validateFutureDate`)
- [x] Unit tests for rate limiter
- [ ] Unit tests for status state machine in appointments API
- [ ] Integration test for booking endpoint (mocked DB)
- [ ] Integration test for cron reminder endpoint (mocked Resend)
- [ ] Configure CI to run tests on push

### 1.2 Rate Limiting (Anonymous Booking)

- [x] Install or implement in-memory rate limiter
- [x] Apply rate limit to POST /api/stores/[storeId]/book (anonymous only)
- [x] Return 429 with Retry-After header when exceeded
- [x] Apply rate limit to POST /api/reviews (authenticated, per-user)
- [x] Verify via build + test

### 1.3 Google Calendar — Expired Token Handling

- [ ] Add `lastSyncError String?` field to CalendarSync model + migration
- [ ] Detect 401 from Google Calendar API in events.ts → store error message
- [ ] Expose error status in GET /api/stores/[storeId]/calendar response
- [ ] Show reconnection warning in dashboard calendar section

### 1.4 Toast Notification System

- [x] Create `src/components/ui/Toast.tsx` — floating notification with variants
- [x] Create toast context + provider for global state
- [x] Integrate into layout + all interactive pages
- [x] Auto-dismiss after 4s, manual dismiss button

## Priority 2 — UX & Scale

### 2.0 Multi-Store Support

- [ ] Remove `@unique` from `Store.ownerId` — change User↔Store to 1:N
- [ ] Add `Store[] stores` relation on User model (replace `Store? store`)
- [ ] Run migration
- [ ] Update `getCurrentStore` API to return list, accept store selection
- [ ] Update onboarding: allow creating additional stores
- [ ] Add store selector to dashboard header
- [ ] Update all owner API routes to verify store belongs to user (already uses `assertOwnerAccess`)

### 2.1 Google Maps Location

- [ ] Add `latitude Float?` and `longitude Float?` to Store model + migration
- [ ] Update onboarding form to accept location (or auto-detect)
- [ ] Display location as Google Maps link on store public page
- [ ] Add map embed on store detail page (optional)

### 2.2 Pagination
- [ ] Verify via build

## Priority 2 — UX & Scale

### 2.0 Toast Notification System

- [ ] Create `src/components/ui/Toast.tsx` — floating notification component with variants (success, error, info, warning)
- [ ] Create `src/lib/toast.tsx` — React context + provider for global toast state
- [ ] Integrate into `src/app/layout.tsx` — wrap with ToastProvider
- [ ] Replace `alert()` / inline error states in dashboard actions (save hours, update settings, confirm/reject appointments)
- [ ] Replace inline error messages in public booking flow (booking form, review submission)
- [ ] Show success toast after: booking created, appointment confirmed/cancelled, settings saved, review submitted
- [ ] Show error toast on: API failures, validation errors, network errors
- [ ] Auto-dismiss after 4 seconds, manual dismiss button

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

### 3.0 Progressive Web App (PWA)

- [ ] Create `public/manifest.json` with app name, icons, theme color
- [ ] Add PWA icons (192x192, 512x512)
- [ ] Register service worker or use Next.js PWA plugin
- [ ] Add `<link rel="manifest">` and `<meta name="theme-color">` to layout
- [ ] Verify app can be installed on mobile/desktop

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
