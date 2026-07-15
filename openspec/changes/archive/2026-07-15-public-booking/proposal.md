# Proposal: Public Booking

## Intent

The platform has a complete owner side (Fases 1-4) but zero public-facing surface. Customers cannot discover stores, view availability, or book appointments. The landing page is still the Next.js starter. This change opens the platform to end users: store discovery, interactive booking, and a customer profile for appointment history, favorites, and reviews.

## Scope

### In Scope
- **Landing page** (`src/app/page.tsx`): Replace starter page. RSC with search-by-specialty via `searchParams`, store cards with `averageRating`
- **Store detail** (`src/app/[slug]/page.tsx`): Store info (RSC) + interactive slot calendar + booking form (client components)
- **Booking flow**: Anonymous → `PENDING` (with `clientEmail`), Authenticated → `CONFIRMED` (with `userId`). Server reads `auth()` to determine status
- **Customer profile** (`src/app/perfil/`): Appointment history, favorite stores, review submission
- **Public API**: Store listing, store detail, slot availability, booking creation, reviews CRUD, favorites toggle

### Out of Scope
- Email/WhatsApp notifications for bookings (Fase 6 — Resend)
- Photo uploads in reviews
- Week/month calendar views (day view only)
- Rate limiting on anonymous bookings

## Capabilities

### New Capabilities
- `public-landing`: Public store discovery — search by specialty, store cards with ratings, SEO-friendly RSC landing page
- `store-booking`: Public booking flow — slot availability, interactive calendar, anonymous/authenticated booking with status logic
- `customer-profile`: Authenticated customer area — appointment history, favorites toggle, review submission with COMPLETED-appointment guard

### Modified Capabilities
- None

## Approach

**Server-centric with client islands.** Landing and store-info are Server Components for SEO. Slot calendar and booking form are `"use client"` — inherently interactive, need `useSession()`. Public API routes bypass `assertOwnerAccess()`; booking endpoint reads `auth()` optionally to set CONFIRMED vs PENDING. Reuse `getAvailableSlots()` from `src/lib/slots.ts` directly. Average rating via Prisma aggregation on store detail.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/page.tsx` | Modified | Full replacement — RSC landing with specialty search |
| `src/app/[slug]/page.tsx` | New | Store detail: info + slot calendar + booking form |
| `src/app/perfil/` | New | Customer profile pages (history, favorites, reviews) |
| `src/app/api/stores/public/` | New | Public store listing + detail endpoints |
| `src/app/api/stores/[slug]/slots/` | New | Public slot availability (no auth) |
| `src/app/api/stores/[slug]/book/` | New | Booking creation (optional auth) |
| `src/app/api/reviews/` | New | Review CRUD (auth for POST) |
| `src/app/api/user/favorites/` | New | Favorite toggle + listing (auth required) |
| `src/app/api/user/appointments/` | New | User appointment history (auth required) |
| `src/lib/stores.ts` | Modified | Add public query helpers |
| `src/lib/appointments.ts` | Modified | Add public booking helpers |
| `prisma/seed.ts` | Modified | Add sample reviews |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Anonymous booking abuse (no rate limit) | Med | Flag for Fase 6; store `clientEmail` for future contact |
| Timezone display confusion | Low | `getAvailableSlots()` already handles TZ; UI labels date with store TZ |
| Invalid slug → poor UX | Low | Graceful 404 page for nonexistent slugs |
| Dashboard page already 469 lines | Low | New pages are separate routes, no dashboard bloat |

## Rollback Plan

All changes are additive (new routes, new pages, new API endpoints). The only modified file is `src/app/page.tsx` (starter page replacement). Rollback = revert PR; landing returns to Next.js default, no data loss.

## Dependencies

- Fases 1-4 complete (owner portal, appointments, auth, Prisma schema)
- `getAvailableSlots()` in `src/lib/slots.ts` — confirmed reusable
- Prisma models: Store, Appointment, Review, BusinessHour, BlockedDate — all exist
- Auth.js session — `auth()` available for optional user detection

## Success Criteria

- [ ] Landing page renders store cards filterable by specialty with average ratings
- [ ] Store detail page shows info + interactive slot calendar for selected date
- [ ] Anonymous user can book (PENDING status, `clientEmail` stored)
- [ ] Authenticated user can book (CONFIRMED status, `userId` linked)
- [ ] `/perfil` shows appointment history, favorites, and allows review submission
- [ ] Review creation requires a COMPLETED appointment with that store
- [ ] `next build` passes with no type errors
