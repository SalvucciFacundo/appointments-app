# Tasks: Admin & Owner Analytics

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 400-550 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + seed + analytics API + dashboard cards + admin routes + admin page + verify | PR 1 | `tsc --noEmit && next build` | Seed DB, log in as OWNER + ADMIN | Revert schema, delete all route files, revert dashboard, delete admin dir |

## Phase 1: Schema

- [x] 1.1 Add `suspended Boolean @default(false)` to Store model in `prisma/schema.prisma`, run `npx prisma db push`

## Phase 2: Owner Analytics

- [x] 2.1 Create `src/app/api/stores/[storeId]/stats/route.ts` — GET computes total by status via `groupBy`, attendance rate (COMPLETED/total), peak hour via raw SQL `EXTRACT(HOUR FROM dateTime)`, repeat customers via `groupBy(clientEmail)` with count > 1
- [x] 2.2 Add analytics section to `src/app/dashboard/page.tsx` — fetch stats on load after store data, render CSS stat cards (total, completed, cancelled, attendance %, peak hour, top returning customer)

## Phase 3: Admin API Routes

- [x] 3.1 `GET /api/admin/stores/route.ts` — list all stores with owner name/email, include `suspended` status, protect with `role === "ADMIN"` check
- [x] 3.2 `PUT /api/admin/stores/[storeId]/route.ts` — toggle `suspended` boolean on Store, return updated store
- [x] 3.3 `GET /api/admin/reviews/route.ts` — list all reviews with store name and user name/email, ordered by newest
- [x] 3.4 `DELETE /api/admin/reviews/[id]/route.ts` — delete a review by id, verify existence first
- [x] 3.5 `GET /api/admin/stats/route.ts` — global metrics: count stores, count appointments, count users (distinct per role)

## Phase 4: Admin Page

- [x] 4.1 Create `src/app/admin/page.tsx` — "use client", fetch from admin API routes, render sections: global metrics cards, stores table (name, owner, suspended toggle button), reviews table (store, user, rating, comment, delete button)

## Phase 5: Seed Data

- [x] 5.1 Add more appointments to `prisma/seed.ts` — include COMPLETED, CANCELLED statuses, repeat clientEmails, varied hours across the day for meaningful analytics

## Phase 6: Verify

- [x] 6.1 Run `npx tsc --noEmit` — confirm no new type errors (pre-existing errors in unrelated files are expected)
- [x] 6.2 Run `npx next build` — confirm build succeeds
