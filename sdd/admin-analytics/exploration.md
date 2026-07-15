# Exploration: admin-analytics

## Current State

The application has three roles (`USER`, `OWNER`, `ADMIN`) with route protection via `src/proxy.ts`. The admin matcher for `/admin/*` is already in place and redirects non-ADMIN users to signin. No admin pages exist yet. The owner dashboard at `/dashboard` is a full client-side SPA with store settings, appointment management (pending queue, today's agenda, day calendar), and Google Calendar sync. Analytics (statistics about appointments, attendance, peak hours) are not yet present.

## Affected Areas

- `src/proxy.ts` — Already has `/admin/*` matcher; no changes needed.
- `src/app/dashboard/page.tsx` — Where owner analytics section would be added (new Card section).
- `prisma/schema.prisma` — Store model needs a `suspended` boolean field for admin suspension feature. Otherwise all needed models exist.
- `src/app/admin/` — Need to create brand new admin pages (`page.tsx`, layout, sub-routes).
- `src/app/api/admin/` — New admin-specific API routes for global operations.
- `src/lib/stores-server.ts` — Need admin query functions (list all stores, suspend/activate).
- `src/lib/reviews-server.ts` — New file for admin review moderation queries.
- `prisma/seed.ts` — Admin user already exists (`admin@appointments.app`). May want to add more sample data for testing analytics.

## Approaches

### Approach 1: Owner Analytics — Compute on the fly in dashboard (server component or API route)

Compute all analytics from the `Appointment` model via Prisma aggregations. No new tables needed.

- **Pros**: Zero schema changes, real-time data, simple.
- **Cons**: Aggregation queries can be slow with large datasets; no historical snapshots.
- **Effort**: Low

### Approach 2: Owner Analytics — Materialized daily snapshots

Create a `StoreAnalytics` table that stores daily pre-computed metrics (total by status, attendance rate, peak hours, returning customers).

- **Pros**: Fast reads, supports historical trends, dashboard loads instantly.
- **Cons**: Schema change, need a cron job or trigger to refresh, more complexity.
- **Effort**: Medium

### Approach 3: Admin Panel — Single page with tabs

All admin functionality (store list, review moderation, global metrics) in one client component with tab navigation.

- **Pros**: Simple routing, shared state, consistent UI.
- **Cons**: Large single bundle, harder to lazy-load.
- **Effort**: Medium

### Approach 4: Admin Panel — Separate sub-routes `/admin/stores`, `/admin/reviews`, `/admin/metrics`

Each admin section is its own route page.

- **Pros**: Natural lazy-loading per route, cleaner separation, easier to test.
- **Cons**: More files, need shared admin layout.
- **Effort**: Medium

### Approach 5: Chart library for analytics

Integrate a chart library (e.g., Recharts, Chart.js via react-chartjs-2) for visualizations.

- **Pros**: Professional-looking charts, interactive tooltips.
- **Cons**: Adds bundle size (~30-50KB gzipped), additional dependency.
- **Effort**: Low (integration) but adds dependency risk.

### Approach 6: CSS-only analytics cards

Render stats as styled cards with numbers, simple progress bars, and maybe horizontal bar charts via CSS.

- **Pros**: Zero dependencies, fast, already matches existing UI pattern.
- **Cons**: Limited visualization options, no interactive charts.
- **Effort**: Low

## Recommendation

**Owner Analytics**: Use **Approach 1** (compute on the fly) with **Approach 6** (CSS-only cards). The dashboard is already a client component that fetches from API routes. Add a new API route `/api/stores/[storeId]/analytics` that runs Prisma aggregation queries. Display results in a new `Card` section on the dashboard. This keeps the MVP lean — no schema changes, no new dependencies, no cron jobs.

**Admin Panel**: Use **Approach 4** (separate sub-routes) with a shared admin layout. This matches the App Router patterns already in use. Create:
- `/admin/page.tsx` — Overview with global metrics
- `/admin/stores/page.tsx` — Store list with suspend/activate
- `/admin/reviews/page.tsx` — Review list with delete

**Charts**: CSS cards for the MVP. If the data warrants it later, Recharts is the natural fit for a React/Next.js project (declarative, tree-shakeable, SSR-compatible).

**Schema change needed**: Add `suspended Boolean @default(false)` to the `Store` model.

## Risks

- **Store suspension field missing**: Prisma schema needs a migration to add `suspended` to the `Store` model. Without this, the suspension feature cannot work.
- **Analytics query performance**: `groupBy` and counting on the `Appointment` table could be slow with thousands of rows. Mitigate by adding a composite index on `[storeId, status]` and `[storeId, dateTime]` — the `@@index([storeId, dateTime])` already exists, but `[storeId, status]` does not.
- **No chart library**: CSS-only charts are limited. If the user expects interactive charts, the effort estimate increases. Flag this during design phase.
- **Admin routes scope creep**: The admin panel could grow to include user management, platform settings, etc. Clearly scope to just store management, review moderation, and global metrics.

## Ready for Proposal

Yes. The exploration is sufficient to move to the proposal phase. The orchestrator should confirm:
1. CSS-only charts vs chart library preference
2. Whether to add the `suspended` field to Store (required for the feature)
3. The admin route structure preference (tabs vs separate routes)
