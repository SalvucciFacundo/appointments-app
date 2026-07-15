# Tasks: Owner Appointments

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450–550 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR — all additive, no existing logic changed |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | All phases (lib + API + components + verify) | PR 1 | `tsc --noEmit && next build` | N/A — no test runner configured; validation via build | Revert the single PR; all changes are additive, zero data loss |

## Phase 1: Shared Lib

- [x] 1.1 Create `src/lib/slots.ts` — `getAvailableSlots(store, date, existing): TimeSlot[]` pure function; generates time windows from business hours, filters blocked dates, checks `maxParallelBookings` capacity
- [x] 1.2 Create `src/lib/appointments.ts` — typed fetch wrappers (`listAppointments`, `updateAppointmentStatus`, `rescheduleAppointment`) following `stores.ts` pattern with `handleResponse`

## Phase 2: API Routes

- [x] 2.1 Create `src/app/api/stores/[storeId]/appointments/route.ts` — GET with optional `date`/`status` filters, sorted by `dateTime` ascending, `assertOwnerAccess` guard; POST for creation if needed
- [x] 2.2 Create `src/app/api/stores/[storeId]/appointments/[id]/route.ts` — PUT with `action` body; enforces state machine (`PENDING→CONFIRMED|CANCELLED`, `CONFIRMED→COMPLETED|CANCELLED`), returns 400 on invalid transition
- [x] 2.3 Create `src/app/api/stores/[storeId]/appointments/[id]/reschedule/route.ts` — PUT with `dateTime` body; validates slot via `getAvailableSlots`, returns 400 if blocked/outside hours/capacity exceeded

## Phase 3: Dashboard Components

- [x] 3.1 Create `src/components/appointments/TodayAgenda.tsx` — today's appointments grouped by status (CONFIRMED, PENDING, COMPLETED, CANCELLED); shows time, client name, service; empty state "No appointments today"
- [x] 3.2 Create `src/components/appointments/PendingQueue.tsx` — PENDING appointments list with `wa.me` link (pre-filled message), Confirm and Reject buttons; optimistic UI updates on action
- [x] 3.3 Create `src/components/appointments/DayCalendar.tsx` — custom CSS grid day view from store open→close; appointment blocks positioned by time, colored by status (PENDING=yellow, CONFIRMED=green, COMPLETED=gray, CANCELLED=red); respects store timezone
- [x] 3.4 Create `src/components/appointments/AppointmentDetail.tsx` — modal component with appointment details + action buttons (status transition + reschedule)
- [x] 3.5 Modify `src/app/dashboard/page.tsx` — import and render `TodayAgenda`, `PendingQueue`, `DayCalendar` below config sections; no existing logic changed

## Phase 4: Verify

- [x] 4.1 Run `tsc --noEmit` — fix any type errors
- [x] 4.2 Run `next build` — verify build passes with no errors
- [x] 4.3 Run `npx prisma validate` — confirm schema is valid
