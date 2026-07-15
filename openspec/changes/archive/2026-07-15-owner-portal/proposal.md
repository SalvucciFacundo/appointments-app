# Proposal: Owner Portal

## Intent

New store owners need a guided onboarding flow and a dashboard to configure their store (hours, slots, blocked dates, cancellation policy). Without this, owners cannot set up or manage their store after signing up — the app has no owner-facing surface yet.

## Scope

### In Scope
- 7 API Route Handlers under `/api/stores/` (create, get, update, hours, blocked dates, current)
- Multi-step onboarding page (`/onboarding`) — store name, description, address, phone, specialty; auto-slug; role upgrade to OWNER
- Dashboard page (`/dashboard`) — store info editor, business hours manager, slot config, blocked dates manager, cancellation policy
- Shared UI form primitives (`src/components/ui/`)

### Out of Scope
- Appointment management UI (Fase 4)
- Calendar integration (Fase 7)
- Analytics dashboard (Fase 8)
- Dashboard styling polish

## Capabilities

### New Capabilities
- `owner-portal`: Store onboarding flow and configuration management (CRUD API + UI pages)

### Modified Capabilities
None — `user-auth` and `project-foundation` remain unchanged.

## Approach

- **API**: Route Handlers at `src/app/api/stores/` — clean contract for current and future clients.
- **UI**: Server Component page shells + Client Component forms with Server Actions for submission. Multi-step onboarding needs client-side state; final submit delegates to the same service layer as Route Handlers.
- **Slug**: Auto-slugify from name input with debounced uniqueness check via GET endpoint; user-editable.
- **UI primitives**: Shared `TextField`, `Select`, `Button` at `src/components/ui/` to avoid repetition across onboarding and dashboard forms.
- **Data**: Prisma schema already complete (Store, BusinessHour, BlockedDate). No migration needed.
- **Auth**: Existing proxy.ts already redirects non-OWNERs from `/dashboard` to `/onboarding`. JWT role injection in place.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/stores/` | New | 7 Route Handlers for store CRUD, hours, blocked dates |
| `src/app/onboarding/` | New | Multi-step onboarding page |
| `src/app/dashboard/` | New | Dashboard with store config sections |
| `src/components/ui/` | New | Shared form primitives (TextField, Select, Button) |
| `src/lib/` | Modified | Add store service layer (shared by API routes and Server Actions) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Partial onboarding (user abandons mid-flow) | Medium | Check for existing incomplete store on re-entry; allow resume |
| Slug collisions under concurrent creation | Low | Unique constraint on `slug` column; return 409 with suggestion |
| Next.js 16 API pattern differences | Low | Follow App Router route handler conventions; verify with `next build` |
| No test runner configured | Medium | Manual verification via browser + curl; testing setup deferred to later change |

## Rollback Plan

All changes are additive (new files only, no modifications to existing auth/proxy/schema). Rollback = delete the new directories: `src/app/api/stores/`, `src/app/onboarding/`, `src/app/dashboard/`, `src/components/ui/`, and the store service in `src/lib/`. No data migration to reverse.

## Dependencies

- Prisma schema already migrated (Store, BusinessHour, BlockedDate models exist)
- Auth.js v5 configured with JWT role injection
- proxy.ts route protection already in place

## Success Criteria

- [ ] Authenticated USER can complete onboarding and become OWNER
- [ ] OWNER can view and edit store settings via dashboard
- [ ] Business hours can be set for each day of the week
- [ ] Blocked dates can be added/removed with a reason
- [ ] Slot configuration (duration, parallel bookings, daily limit) persists correctly
- [ ] `next build` completes without errors
