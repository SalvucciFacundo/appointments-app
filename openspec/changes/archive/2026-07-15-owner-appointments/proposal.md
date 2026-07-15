# Proposal: Owner Appointments

## Intent

Store owners have no way to view, manage, or act on appointments after customers book them. PENDING appointments sit unprocessed — no confirm/reject, no reschedule, no daily overview. Without an appointment management surface, the dashboard is a config panel with no operational value.

## Scope

### In Scope
- **API**: GET/PUT appointments under `/api/stores/[storeId]/appointments`
- **API**: PUT reschedule endpoint with slot availability validation
- **Dashboard**: Today's agenda summary, appointment list with status/date filters, PENDING queue
- **PENDING management**: wa.me quick-contact link, confirm/reject actions
- **Calendar**: Custom day view — time grid with appointment blocks (no external library)
- **Shared lib**: `src/lib/slots.ts` (availability logic), `src/lib/appointments.ts` (API client)

### Out of Scope
- Public booking flow (Fase 5)
- Week/month calendar views
- Email/WhatsApp notifications (Fase 6)
- Drag-and-drop rescheduling

## Capabilities

### New Capabilities
- `owner-appointments`: Owner-facing appointment management — list, filter, confirm/reject PENDING, reschedule, and day-view calendar

### Modified Capabilities
- None

## Approach

Route Handlers under `/api/stores/[storeId]/appointments` follow the existing sub-resource pattern (hours, blocked-dates). Slot availability is a pure function in `src/lib/slots.ts` — takes business hours, blocked dates, existing appointments, and returns open slots. The dashboard page is decomposed into focused client components (`TodayAgenda`, `AppointmentList`, `PendingQueue`, `DayCalendar`). Status transitions enforced server-side: PENDING→CONFIRMED→COMPLETED, any→CANCELLED, no reverse.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/stores/[storeId]/appointments/` | New | Route Handlers: GET (list/filter), PUT (update/reschedule) |
| `src/app/dashboard/` | Modified | Add appointment sections as new client components |
| `src/lib/slots.ts` | New | Pure function: slot availability calculation |
| `src/lib/appointments.ts` | New | API client for appointment CRUD |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Concurrent bookings create slot conflicts | Med | Atomic Prisma transactions + slot validation on every write |
| Timezone mismatch in day-view rendering | Med | Store timezone from schema; convert UTC→store TZ in API, render in store TZ on client |
| Dashboard page grows too large (469 lines already) | High | Extract each section as separate component file before adding appointment views |

## Rollback Plan

All changes are additive (new API routes, new components, new lib files). No existing files are deleted. Rollback = revert the PR; the dashboard returns to config-only state with no data loss.

## Dependencies

- Owner portal (Fase 3) — must be complete (dashboard + store config API)
- Auth roles — route protection for `/dashboard` must be active
- Prisma schema — `Appointment` model and `AppointmentStatus` enum already exist

## Success Criteria

- [ ] Owner can view all appointments for their store with status and date filters
- [ ] Owner can confirm or reject PENDING appointments from the dashboard
- [ ] Owner can reschedule an appointment with slot availability validation
- [ ] Day-view calendar renders appointments as time-positioned blocks
- [ ] wa.me link opens WhatsApp with pre-filled message for PENDING clients
- [ ] `next build` passes with no type errors
