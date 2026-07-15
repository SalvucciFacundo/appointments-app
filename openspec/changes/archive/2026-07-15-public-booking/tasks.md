# Tasks: Public Booking

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-800 |
| 400-line budget risk | Low (resolved, single apply batch) |
| Chained PRs recommended | No |
| Suggested split | N/A (single batch) |
| Delivery strategy | ask-on-risk (resolved) |
| Chain strategy | single-pr |

Decision needed before apply: Resolved (orchestrator provided all tasks)
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test | Runtime harness | Rollback |
|------|------|-----------|-------------|-----------------|----------|
| 1 | Foundation + API routes + UI components | PR 1 | `tsc --noEmit` | `curl /api/stores/public` | Revert PR 1 |
| 2 | Landing + store pages + customer profile + verify | PR 2 | `next build` | Visit `/`, `/[slug]`, `/perfil` | Revert PR 2 |

## Phase 1: Foundation

- [x] 0.1 Add `getPublicStores()` + `getStoreBySlug()` to `src/lib/stores.ts` — avg rating via Prisma aggregation
- [x] 0.2 Add `createPublicBooking()` helper to `src/lib/stores.ts` (added as `createBooking`)
- [x] 0.3 Update `prisma/seed.ts` with sample reviews for rating data

## Phase 2: Public API Routes

- [x] 1.1 `src/app/api/stores/public/route.ts` — GET list stores, avg rating, `?specialty=` partial filter
- [x] 1.2 `src/app/api/stores/public/[slug]/route.ts` — GET store detail with hours, avg rating
- [x] 1.3 `src/app/api/stores/[storeId]/slots/route.ts` — GET available slots for `?date=`, reuse `getAvailableSlots()` (uses storeId dir, public lookup by slug)
- [x] 1.4 `src/app/api/stores/[storeId]/book/route.ts` — POST create appointment (auth → CONFIRMED+userId, else PENDING+clientEmail)

## Phase 3: UI Components

- [x] 2.1 `src/components/ui/StarRating.tsx` — read-only display + interactive input mode
- [x] 2.2 `src/components/ui/StoreCard.tsx` — card with name, specialty, rating, links to `/[slug]`
- [x] 2.3 `src/components/ui/SearchBar.tsx` — search input with specialty pill filters

## Phase 4: Landing + Store Pages

- [x] 3.1 Replace `src/app/page.tsx` — RSC with direct Prisma query, `?specialty` filter, StoreCard grid
- [x] 3.2 `src/app/[slug]/page.tsx` — RSC store detail: info, hours, slots client islands
- [x] 3.3 `src/app/[slug]/SlotCalendar.tsx` — client date picker + slot grid, calls slots API
- [x] 3.4 `src/app/[slug]/BookingForm.tsx` — client form (name/phone/email), calls book API, session-aware

## Phase 5: Customer Profile

- [x] 4.1 `src/app/api/user/appointments/route.ts` — GET authenticated user's appointment history
- [x] 4.2 `src/app/api/user/favorites/route.ts` — GET list / POST toggle favorite stores
- [x] 4.3 `src/app/api/reviews/route.ts` — POST create review (auth + COMPLETED appointment guard)
- [x] 4.4 `src/app/perfil/page.tsx` (history list) + `src/app/perfil/favoritos/page.tsx` (favorites toggle)

## Phase 6: Verify

- [x] 5.1 Run `tsc --noEmit` — fix all type errors
- [x] 5.2 Run `next build` — verify production build passes
