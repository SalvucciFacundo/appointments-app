# Design: Owner Portal

## Technical Approach

Route Handlers under `src/app/api/stores/` provide the API contract. Client Component forms with `fetch()` handle UI submission with inline validation. The existing `proxy.ts` must be wired as `src/middleware.ts` to enforce route protection. Prisma singleton provides direct data access — no service layer indirection needed at this scale.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| API layer | Route Handlers (`src/app/api/stores/`) | Server Actions | Clean REST contract; forms need real-time client validation anyway; Route Handlers are standard App Router pattern |
| Form submission | Client Components + `fetch()` | Server Actions | Real-time validation needs client state; Server Actions add RSC serialization complexity with no benefit here |
| Auth in API routes | `auth()` helper from `@/auth` | Custom JWT verify | Already configured; provides session with role; consistent with existing pattern |
| Middleware | Wire `proxy.ts` → `src/middleware.ts` | Inline middleware | Code exists but is not connected; adding `/onboarding` matcher needed |
| Slug generation | Auto-slugify from name, 409 on collision | User-editable slug field | Spec requires auto-generation; collision returns 409 with suggestion |
| Business hours | Single PUT replaces all hours | Individual CRUD per day | Simpler API; hours always managed as a complete set (7 days) |
| Dashboard layout | Single page with collapsible sections | Tab navigation | Fewer routes; all config visible at once; matches "sections" language in spec |
| UI primitives | Shared `TextField`, `Select`, `Button` in `src/components/ui/` | Inline styles per page | Avoids repetition across onboarding + dashboard forms |

## Data Flow

```
ONBOARDING:
  Browser ──POST /api/stores──→ Route Handler
                                    │
                              ┌─────┴─────┐
                              │ Validate   │
                              │ Slugify    │
                              │ Prisma tx: │
                              │  create    │
                              │  Store     │
                              │  + update  │
                              │  User.role │
                              └─────┬─────┘
                                    │
  Browser ←── 201 {store} ─────────┘
  redirect → /dashboard

DASHBOARD:
  Browser ──GET /api/stores/current──→ auth() → Prisma → 200 {store+hours+blocked}
  Browser ──PUT /api/stores/[id]─────→ auth() → ownership check → Prisma update → 200
  Browser ──PUT /api/stores/[id]/hours──→ auth() → validate → deleteAll+createMany → 200
  Browser ──POST /api/stores/[id]/blocked-dates──→ auth() → validate future → create → 201
  Browser ──DELETE /api/stores/[id]/blocked-dates/[bid]──→ auth() → delete → 204
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/middleware.ts` | Create | Wire proxy.ts logic; add `/onboarding` to matcher; redirect non-OWNERs |
| `src/app/api/stores/route.ts` | Create | POST (create store) + GET (list/current) |
| `src/app/api/stores/[storeId]/route.ts` | Create | GET + PUT store settings |
| `src/app/api/stores/[storeId]/hours/route.ts` | Create | PUT business hours (replace all) |
| `src/app/api/stores/[storeId]/blocked-dates/route.ts` | Create | POST blocked date |
| `src/app/api/stores/[storeId]/blocked-dates/[id]/route.ts` | Create | DELETE blocked date |
| `src/app/onboarding/page.tsx` | Create | Multi-step onboarding form (Client Component) |
| `src/app/dashboard/page.tsx` | Create | Dashboard with collapsible sections |
| `src/app/dashboard/settings/page.tsx` | Create | Store settings (hours, slots, blocked dates) |
| `src/components/ui/TextField.tsx` | Create | Reusable text input with label + error |
| `src/components/ui/Select.tsx` | Create | Reusable select with label + error |
| `src/components/ui/Button.tsx` | Create | Reusable button (primary/secondary/danger) |
| `src/lib/slug.ts` | Create | Slug generation utility (slugify + collision suffix) |
| `src/lib/validators.ts` | Create | Shared validation (HH:MM, dayOfWeek 0-6, future date) |

## Interfaces / Contracts

```typescript
// POST /api/stores
interface CreateStoreBody {
  name: string;        // required, non-empty
  description?: string;
  address: string;     // required
  phone?: string;
  specialty: string;   // required
}
// → 201 { store: Store } | 400 { errors: FieldError[] } | 409 { slug: string }

// PUT /api/stores/[storeId]/hours
interface BusinessHourInput {
  dayOfWeek: number;   // 0-6
  open: string;        // "HH:MM"
  close: string;       // "HH:MM"
}
// → 200 { hours: BusinessHour[] } | 400 { errors: FieldError[] }

// POST /api/stores/[storeId]/blocked-dates
interface BlockedDateInput {
  date: string;        // "YYYY-MM-DD", must be future
  reason?: string;
}
// → 201 { blockedDate: BlockedDate } | 400 { errors: FieldError[] }

// Ownership guard (shared helper)
function assertOwnerAccess(sessionUserId: string, storeOwnerId: string): void;
// throws 403 if mismatch
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `slug.ts`, `validators.ts` | Pure functions — test slugify edge cases, time format, day bounds |
| Integration | API routes | Manual via browser + curl (no test runner configured) |
| E2E | Onboarding → Dashboard flow | Deferred — no test infrastructure yet |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. All changes are additive (new files). Prisma schema already has Store, BusinessHour, BlockedDate models.

## Open Questions

- [ ] `proxy.ts` is not wired as middleware — confirm this is intentional or needs fixing as part of this change
- [ ] Onboarding resume: spec requires restoring abandoned form values, but no draft/partial-store mechanism exists in schema — use `localStorage` on client side?
