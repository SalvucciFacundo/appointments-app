# Design: Owner Appointments

## Technical Approach

Add owner-facing appointment management as a sub-resource under `/api/stores/[storeId]/appointments`, following the existing pattern established by `hours/` and `blocked-dates/`. Slot availability is extracted into a pure function (`src/lib/slots.ts`) shared between the reschedule API and the future public booking flow. The monolithic 469-line dashboard page is decomposed — appointment sections become separate client components imported into the existing page.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| API shape | Sub-resource vs standalone `/api/appointments` | Sub-resource reuses `assertOwnerAccess` + store scoping | Sub-resource under stores |
| Slot logic | Pure function vs Prisma middleware | Pure function is testable, reusable by public booking | `src/lib/slots.ts` pure function |
| Status transitions | Per-endpoint vs single PUT with `action` | Single endpoint = one place to enforce state machine | Single PUT with `action` field |
| Calendar | External lib vs custom CSS grid | No external dep, simple day-only view needed | Custom CSS grid |
| Dashboard growth | Inline vs extracted components | 469 lines already; extraction prevents further bloat | Extract to `src/components/appointments/` |
| Timezone | Store in local TZ vs UTC | UTC in DB is standard; convert at API boundary | UTC in DB, convert at API layer using `store.timezone` |

## Data Flow

```
Dashboard (client)
    │
    ├── GET /api/stores/{id}/appointments?date=&status=
    │       │
    │       └── assertOwnerAccess → prisma.appointment.findMany → sort by dateTime
    │
    ├── PUT /api/stores/{id}/appointments/{aptId}  (action: CONFIRM|REJECT|COMPLETE)
    │       │
    │       └── assertOwnerAccess → validate state machine → prisma.appointment.update
    │
    └── PUT /api/stores/{id}/appointments/{aptId}/reschedule
            │
            └── assertOwnerAccess → getAvailableSlots() → validate new slot → prisma.appointment.update
```

```
getAvailableSlots(store, date, existingAppointments)
    │
    ├── Load businessHours for date's dayOfWeek
    ├── Load blockedDates for date
    ├── Generate time windows [open..close) by slotDuration
    ├── Filter out blocked dates
    ├── Count existing appointments per window
    └── Return windows where count < maxParallelBookings
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/stores/[storeId]/appointments/route.ts` | Create | GET (list + filter) + POST (optional create) |
| `src/app/api/stores/[storeId]/appointments/[id]/route.ts` | Create | PUT status transition with state machine |
| `src/app/api/stores/[storeId]/appointments/[id]/reschedule/route.ts` | Create | PUT reschedule with slot validation |
| `src/lib/slots.ts` | Create | Pure function: `getAvailableSlots(store, date, existing)` |
| `src/lib/appointments.ts` | Create | Typed fetch wrappers following `stores.ts` pattern |
| `src/components/appointments/TodayAgenda.tsx` | Create | Today's appointments grouped by status |
| `src/components/appointments/PendingQueue.tsx` | Create | PENDING queue with wa.me + confirm/reject |
| `src/components/appointments/DayCalendar.tsx` | Create | Custom CSS grid day view |
| `src/components/appointments/AppointmentDetail.tsx` | Create | Modal with details + reschedule |
| `src/app/dashboard/page.tsx` | Modify | Import and render appointment components below config sections |

## Interfaces / Contracts

```typescript
// src/lib/slots.ts
export interface TimeSlot {
  start: string  // HH:MM
  end: string    // HH:MM
  available: boolean
  currentBookings: number
}

export function getAvailableSlots(
  store: { businessHours: BusinessHour[]; blockedDates: BlockedDateData[]; slotDuration: number; maxParallelBookings: number },
  date: string,        // YYYY-MM-DD
  existing: { dateTime: Date }[]
): TimeSlot[]

// src/lib/appointments.ts
export interface AppointmentData {
  id: string
  storeId: string
  clientName: string
  clientPhone: string
  clientEmail: string
  dateTime: string
  service: string | null
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
  notes: string | null
}

export function listAppointments(storeId: string, filters?: { date?: string; status?: string }): Promise<AppointmentData[]>
export function updateAppointmentStatus(storeId: string, id: string, action: "CONFIRM" | "REJECT" | "COMPLETE"): Promise<AppointmentData>
export function rescheduleAppointment(storeId: string, id: string, dateTime: string): Promise<AppointmentData>

// State machine (server-enforced)
const TRANSITIONS: Record<string, string[]> = {
  PENDING:   ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
}
// Action mapping: CONFIRM → CONFIRMED, REJECT → CANCELLED, COMPLETE → COMPLETED
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `getAvailableSlots` pure function | Test with various store configs, blocked dates, capacity scenarios |
| Unit | State machine transitions | Test valid/invalid transitions |
| Integration | API routes | Verify auth, filtering, slot validation (blocked by no test runner — defer) |
| Build | Type safety | `next build` must pass with no type errors |

Note: No test runner is configured yet. Unit tests for `slots.ts` should be added when a runner is set up. For now, validation is via `next build`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. All changes are additive (new API routes, new components, new lib files). The Prisma schema already has the `Appointment` model and `AppointmentStatus` enum. The `@@index([storeId, dateTime])` compound index supports the list/filter queries efficiently.

## Open Questions

- None
