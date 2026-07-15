## Exploration: owner-appointments

### Current State
Fases 1-3 are complete. The project has:
- **Prisma schema** with `Appointment` model (PENDING, CONFIRMED, CANCELLED, COMPLETED) and full `Store` config (slotDuration, maxParallelBookings, maxSlotsPerDay, cancelationLimit, businessHours, blockedDates)
- **Auth.js v5** with JWT role injection (`USER`, `OWNER`, `ADMIN`) and `proxy.ts` guarding `/dashboard/*` for OWNERs
- **API route pattern**: `/api/stores/[storeId]/` + subresources (`hours`, `blocked-dates`) using `assertOwnerAccess` helper — ownership-scoped, validated, Prisma-driven
- **Dashboard page** (`src/app/dashboard/page.tsx`): Client Component with sections for Store Info, Business Hours, Slot Settings, and Blocked Dates — all wired to `src/lib/stores.ts` fetch wrappers
- **UI primitives**: `Input`, `Button`, `Card` components used consistently
- **No appointment-related code** exists anywhere in `src/` — no API routes, no lib helpers, no components

### Affected Areas
- `src/app/api/stores/[storeId]/appointments/route.ts` — **NEW**: GET (list filtered), POST (manual create)
- `src/app/api/stores/[storeId]/appointments/[id]/route.ts` — **NEW**: PUT (status change), PUT (reschedule)
- `src/lib/stores.ts` — Add appointment fetch wrappers (or create `src/lib/appointments.ts`)
- `src/app/dashboard/page.tsx` — Add appointment sections (Today's agenda, PENDING queue, calendar view)
- `src/components/` — **NEW**: AppointmentCard, PendingAlert, DayCalendar components
- `src/proxy.ts` — Already protects `/dashboard/*` for OWNERs. No changes needed.
- `prisma/schema.prisma` — Already has Appointment model. No migration needed.

### Approaches

**1. API Routing — Sub-resource under stores**
  `/api/stores/[storeId]/appointments`
  - Pros: Consistent with existing pattern (`hours`, `blocked-dates`), automatic ownership scoping via `assertOwnerAccess`, natural Prisma queries (`store.appointments`)
  - Cons: Slightly longer URLs, but irrelevant for internal API
  - Effort: Low

**2. API Routing — Top-level `/api/appointments`**
  Query storeId via query params or JWT claim lookup
  - Pros: Shorter URLs, more REST-ish for appointment-centric queries
  - Cons: Breaks established pattern, requires manual store ownership check in every endpoint (no shared `assertOwnerAccess`), no precedent in this codebase
  - Effort: Medium

**3. Calendar Component — Custom Day View**
  Build a pure CSS/HTML/JS day calendar that renders time slots as a vertical grid with existing booked appointments
  - Pros: Zero dependencies, full control over styling (the spec mandates premium aesthetics), bundle size stays small, easy to extend to week/month later
  - Cons: More code to write, no drag-and-drop (deferred to future per spec)
  - Effort: Medium

**4. Calendar Component — Library (e.g., react-big-calendar, fullcalendar)**
  - Pros: Feature-rich out of the box (week/month views, drag-and-drop)
  - Cons: Heavy bundle (200KB+), CSS overrides needed for premium look, overkill for day-only MVP, spec says drag-and-drop is "opcional/futuro"
  - Effort: Low (integration) but high (overhead)

### Recommendation

**API routing**: Use **Approach 1** (sub-resource under stores). It's the path of least resistance — the auth guard, file structure, and developer expectations are already set by the existing routes. The consistency is worth more than theoretical URL purity.

**Appointment status flow**:
```
PENDING ──→ CONFIRMED ──→ COMPLETED
  │             │
  └──→ CANCELLED     └──→ CANCELLED
```
- `PENDING → CONFIRMED`: Owner approves anonymous booking
- `PENDING → CANCELLED`: Owner rejects anonymous booking
- `CONFIRMED → COMPLETED`: Service rendered
- `CONFIRMED → CANCELLED`: Owner or client cancels confirmed booking
- No reverse transitions allowed (CONFIRMED → PENDING, COMPLETED → anything)

**wa.me link**: `https://wa.me/{clientPhone}?text=Hola%20{clientName}%2C%20te%20escribo%20por%20tu%20turno%20del%20{day}%20a%20las%20{time}%20en%20{storeName}.` — generated client-side in the PENDING alert component.

**Calendar**: Use **Approach 3** (custom day view). The spec says "vistas por Día, Semana y Mes" but the MVP needs only the day view. A custom implementation gives pixel-perfect control over the premium look the design calls for, and avoids the 200KB+ overhead of FullCalendar.

**Lib file**: Create `src/lib/appointments.ts` as a separate file rather than bloating `stores.ts`. It follows the same patterns and keeps concerns separated.

### Risks
- **Timezone handling**: `dateTime` is stored in UTC. The calendar view must convert to the store's timezone (stored in `Store.timezone`). The business hours are stored as local time strings. Both must be reconciled to render correct slots.
- **Slot conflict detection on reschedule**: When the owner manually reschedules, the system must verify the new slot isn't over capacity. This logic must be shared with the future public booking API — should live in a pure function, not embedded in the route handler.
- **No tests**: Like the rest of the project, no test runner is configured. The slot availability logic would benefit greatly from unit tests, especially the edge cases around booking limits and timezone conversion.
- **PENDING queue UX**: If there are many PENDING appointments, the dashboard section could grow unwieldy. Consider collapsible sections or a separate tab pattern.
- **Next.js version**: Uses Next.js 16.2.10 — need to verify Route Handler patterns haven't changed (e.g., params API, response patterns).

### Ready for Proposal
Yes. The codebase is fully prepared. The Prisma schema has the Appointment model, the auth guards are in place, the API route pattern is well-established, and the dashboard page is waiting for additional sections. The exploration clearly identifies the API structure, component breakdown, status machine, and calendar approach.
