## Exploration: public-booking

### Current State

The app has a functioning owner dashboard (Fases 1-4): Prisma schema with all models, Auth.js v5 with Google provider, owner-only API routes protected by `assertOwnerAccess()`, slot logic as a pure function in `src/lib/slots.ts`, and a proxy for route protection (`/admin/*`, `/dashboard/*`, `/perfil/*`). The landing page is still the default Next.js starter page, the store detail page (`[slug]/page.tsx`) doesn't exist, and `/perfil/*` routes don't exist yet (though the proxy already has the matcher).

### Affected Areas

| File | Why Affected |
|------|-------------|
| `src/app/page.tsx` | Full replacement — landing page with search by specialty, store cards with ratings |
| `src/app/[slug]/page.tsx` | **New** — Store detail page with info + slot calendar + booking form |
| `src/app/perfil/` | **New** — Customer profile: appointment history, favorites, reviews |
| `src/app/api/stores/public/route.ts` | **New** — Public store listing with optional specialty filter |
| `src/app/api/stores/public/[slug]/route.ts` | **New** — Public single store detail (with hours, blocked dates, avg rating) |
| `src/app/api/stores/[slug]/slots/route.ts` | **New** — Public slot availability endpoint (no auth) |
| `src/app/api/stores/[slug]/book/route.ts` | **New** — Public booking creation (accepts optional auth session) |
| `src/app/api/reviews/route.ts` | **New** — Review creation & listing (auth required for POST) |
| `src/app/api/user/favorites/route.ts` | **New** — Favorite store toggle & listing (auth required) |
| `src/app/api/user/appointments/route.ts` | **New** — User's own appointment history (auth required) |
| `src/lib/stores.ts` | Extend with public API client functions |
| `src/lib/appointments.ts` | Extend with public booking client functions |
| `src/components/ui/` | May need new components (StarRating, SlotCalendar, SearchBar) |
| `prisma/seed.ts` | Should add sample reviews |

### Approaches

#### 1. **Server-Centric Landing + Client Booking** (recommended)
- Landing page: Server Component that fetches stores, filterable via search params (Server-side filtering)
- Store page: Server Component for store info + Client Component for interactive slot calendar/booking
- Perfil pages: Mixed — Server Component for layout, Client Components for interactive parts
- New API routes for public data that bypass `assertOwnerAccess` and use `auth()` optionally
- Reuse `getAvailableSlots()` directly in the slots API endpoint

   - **Pros**: Follows Next.js App Router patterns (RSC by default), good SEO for landing/store pages, slot logic already proven
   - **Cons**: Requires new public API endpoints (no existing pattern for public routes), booking form needs careful client state management
   - **Effort**: Medium

#### 2. **Fully Client-Side Public Pages**
- All public pages are `"use client"` that call public API endpoints
- Landing page renders store cards after client fetch, with client-side filtering

   - **Pros**: Simpler to implement, consistent with existing dashboard page pattern
   - **Cons**: Worse SEO, extra client loading states, misses the benefit of RSC
   - **Effort**: Low-Medium

### Recommendation

**Approach 1** — Server Component landing + store info, client component for interactive parts (calendar/booking). The landing page should be a Server Component that receives `searchParams.specialty` for filtering, renders store cards with `averageRating` from the DB via a helper. The slot calendar is inherently interactive → `"use client"`. The booking form needs session context → `"use client"` with `useSession()`. Perfil pages can be server layouts with client appointment lists.

### Key Design Decisions

1. **New public API endpoints** — separate routes that don't call `assertOwnerAccess()`. Pattern: `GET /api/stores/public?specialty=` for listing, `GET /api/stores/public/[slug]` for detail, `POST /api/stores/[slug]/book` for booking (accepts optional `userId` from session in request body or via `auth()` server-side).
2. **Slot reuse** — the slots endpoint fetches store + businessHours + blockedDates + appointments for the date, calls `getAvailableSlots()`, returns result. Same pattern as the reschedule endpoint.
3. **Booking status logic** — read session server-side: if `session?.user?.id`, store `userId` and set `status: CONFIRMED`; otherwise `userId: null`, `status: PENDING`.
4. **Favorites** — use existing many-to-many relation. Simple toggle API: `POST /api/user/favorites` with `{ storeId }` toggles via `disconnect`/`connect`.
5. **Reviews** — `POST /api/reviews` requires auth AND an existing completed appointment with that store (query `Appointment` where `userId + storeId + status = COMPLETED`).
6. **Average rating** — computed via Prisma aggregation on the public store detail endpoint, or stored as a denormalized field. Aggregation is cleaner for now.

### Risks

- **No rate limiting** on anonymous booking endpoint — could be abused. Mitigation: add basic rate limiting or CAPTCHA consideration (out of scope for this phase but worth flagging).
- **Timezone display** in the booking calendar — slots must display in the store's timezone, but the user sees them. The existing `getAvailableSlots` already handles this; the UI just needs to communicate the date in the store's timezone.
- **Proxy matcher doesn't block `[slug]`** — by design it's public, but need to handle 404 for invalid slugs gracefully.
- **Email notification for anonymous bookings** — deferred to Phase 6 (Resend). The booking creation should store clientEmail but not send email yet.

### Ready for Proposal

Yes. The exploration is complete — all code paths have been read, the slot logic is confirmed reusable, the data model supports everything needed, and the API endpoint pattern is established. The orchestrator should proceed with `sdd-propose`.
