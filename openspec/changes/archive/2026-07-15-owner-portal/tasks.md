# Tasks: Owner Portal

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-650 (14 new files, all additive) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium
```

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Shared lib + UI primitives (Phase 1) | Single PR | `tsc --noEmit` | `next dev` → verify imports resolve | `git revert` of 6 new files |
| 2 | API routes (Phase 2) | Single PR | `tsc --noEmit` | `next dev` → curl POST/GET/PUT/DELETE | `git revert` of 5 new route files |
| 3 | Pages + verify (Phase 3-4) | Single PR | `tsc --noEmit && next build` | `next dev` → browser onboarding+dashboard | `git revert` of 3 new files |

> **Note**: All changes are additive with no existing code modifications. Single PR is safe despite size — no rollback risk to existing functionality. Suggested work units are logical slices only; they share no dependency conflicts.

## Phase 1: Shared Lib + UI Primitives

- [x] 1.1 Create `src/lib/slug.ts` — `generateSlug(name)` auto-slugifies; collision suffix via `findFirst` + counter loop
- [x] 1.2 Create `src/lib/stores.ts` — typed fetch wrappers: `fetchCurrentStore`, `updateStore`, `updateHours`, `createBlockedDate`, `deleteBlockedDate`; all return typed JSON or throw on non-ok
- [x] 1.3 Create `src/components/ui/Input.tsx` — reusable input with label, error display, forwardRef; accepts `label`, `error`, and standard input props
- [x] 1.4 Create `src/components/ui/Button.tsx` — `primary`/`secondary`/`danger` variants, `loading` state with disabled, `type` prop
- [x] 1.5 Create `src/components/ui/Card.tsx` — container with optional `title` prop, padding, border, shadow

## Phase 2: API Routes

- [x] 2.1 Create `src/app/api/stores/route.ts`:
  - `POST` — `auth()` guard, validate body, call `generateSlug` with collision 409, Prisma tx: create Store + update User.role→OWNER, return 201
  - `GET` — `auth()` guard, `findFirst` where ownerId=session.user.id, return 200 with store or 404
- [x] 2.2 Create `src/app/api/stores/[storeId]/route.ts`:
  - `GET` — `auth()` guard, `assertOwnerAccess`, return store with hours+blockedDates, 404 if missing
  - `PUT` — `auth()` guard, `assertOwnerAccess`, validate body, Prisma update, return 200
- [x] 2.3 Create `src/app/api/stores/[storeId]/hours/route.ts`:
  - `PUT` — `auth()` guard, `assertOwnerAccess`, validate dayOfWeek 0-6 + HH:MM format, `deleteMany` + `createMany` in tx, return 200
- [x] 2.4 Create `src/app/api/stores/[storeId]/blocked-dates/route.ts`:
  - `POST` — `auth()` guard, `assertOwnerAccess`, validate date is future, Prisma create, return 201
- [x] 2.5 Create `src/app/api/stores/[storeId]/blocked-dates/[id]/route.ts`:
  - `DELETE` — `auth()` guard, `assertOwnerAccess`, Prisma delete, return 204

## Phase 3: Pages

- [x] 3.1 Create `src/app/onboarding/page.tsx` — Client Component, multi-step form (name→address→specialty→review), POST `/api/stores`, redirect to `/dashboard` on success; error display per field
- [x] 3.2 Create `src/app/dashboard/page.tsx` — Client Component, fetch current store on mount, collapsible sections: store info (PUT), business hours (PUT hours), blocked dates (POST + DELETE), cancellation policy; loading skeleton while fetching

## Phase 4: Verify

- [x] 4.1 Run `tsc --noEmit` — fix any type errors across all new files
- [x] 4.2 Run `next build` — fix any build errors
- [x] 4.3 Add `/onboarding` and `/dashboard` to `proxy.ts` matcher array if missing; verify both paths redirect unauthenticated users to sign-in

## Key Design Notes

- **Auth guard**: Use `auth()` from `@/auth` in all API routes; redirect to sign-in when session missing
- **Ownership guard**: Shared `assertOwnerAccess(sessionUserId, storeOwnerId)` helper across store-scoped routes; throws 403 Response
- **Slug collision**: `generateSlug` queries `Store.findFirst({ where: { slug } })` in a loop appending `-1`, `-2` etc. until unique
- **Business hours PUT**: Delete all existing hours for store, then createMany with validated input — atomic in Prisma tx
- **Blocked date**: Date string parsed to `new Date(date)` with `.toISOString()` for Prisma; validate > now at day granularity
- **No middleware.ts created**: `proxy.ts` exists but isn't wired; Phase 4.3 only adjusts the matcher — wiring as middleware is deferred
