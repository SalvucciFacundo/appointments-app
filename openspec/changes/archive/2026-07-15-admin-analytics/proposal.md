# Proposal: Admin & Owner Analytics

## Summary

Add owner-facing analytics to the dashboard (CSS stat cards) and build an admin panel at `/admin` for platform-wide store management, review moderation, and global metrics.

## Motivation

The platform has three roles (USER, OWNER, ADMIN) with route protection already in place via `src/proxy.ts`, but:
- The owner dashboard has no analytics section — owners can't see appointment stats, attendance rates, or peak hours.
- No admin pages exist despite ADMIN role being seeded and proxied.

## In Scope

1. **Schema**: Add `suspended Boolean @default(false)` to Store model for admin suspension.
2. **Owner Analytics**: New `GET /api/stores/[storeId]/stats` route computing total appointments by status, attendance rate (COMPLETED / total), peak hour (EXTRACT(HOUR FROM dateTime) group), and repeat customers (clientEmail count). CSS stat cards on the dashboard.
3. **Admin API Routes**:
   - `GET /api/admin/stores` — list stores with owner info + suspended status.
   - `PUT /api/admin/stores/[storeId]` — toggle suspended.
   - `GET /api/admin/reviews` — list reviews with store + user info.
   - `DELETE /api/admin/reviews/[id]` — delete a review.
   - `GET /api/admin/stats` — global metrics (total stores, appointments, users).
4. **Admin Pages**: `/admin` dashboard with stores table, reviews table, and global metrics section.
5. **Seed**: Add more test appointments with varied statuses for meaningful analytics.

## Out of Scope

- Interactive charts/graphs (CSS cards only).
- Notification delivery rate metrics (no tracking infrastructure).
- Pagination for large datasets (MVP, assume <1000 records).
- Admin CRUD for users beyond review deletion and store suspension.

## Approach

- **API pattern**: Follow existing `src/lib/api-helpers.ts` patterns (`requireAuth`, `Response.json`). Admin routes check `session.user.role === "ADMIN"` inline.
- **Analytics queries**: Use Prisma aggregation via `groupBy` and raw `$queryRaw` for `EXTRACT(HOUR ...)`.
- **UI**: Add analytics section to the existing dashboard page (`src/app/dashboard/page.tsx`) after the Calendar Sync card. Admin panel is a new layout under `src/app/admin/`.
- **Protection**: Proxy already guards `/admin/*` (ADMIN role). Owner analytics route uses `assertOwnerAccess`.

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `suspended` field to Store |
| `prisma/seed.ts` | Modify | Add more appointments with varied statuses |
| `src/app/api/stores/[storeId]/stats/route.ts` | Create | Owner analytics endpoint |
| `src/app/dashboard/page.tsx` | Modify | Add analytics stat cards section |
| `src/app/api/admin/stores/route.ts` | Create | List stores |
| `src/app/api/admin/stores/[storeId]/route.ts` | Create | Toggle suspension |
| `src/app/api/admin/reviews/route.ts` | Create | List reviews |
| `src/app/api/admin/reviews/[id]/route.ts` | Create | Delete review |
| `src/app/api/admin/stats/route.ts` | Create | Global metrics |
| `src/app/admin/page.tsx` | Create | Admin dashboard |

## Rollback

- **Schema**: Revert `suspended` field from Store model, revert seed.
- **API routes**: Delete route files in `src/app/api/admin/` and `src/app/api/stores/[storeId]/stats/`.
- **UI**: Revert dashboard page changes, delete `src/app/admin/` directory.
