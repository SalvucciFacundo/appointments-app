# Design: Public Booking

## Technical Approach

Open the platform to end users with a server-centric architecture: RSC for SEO-critical pages (landing, store info), client islands for interactive booking, and public API routes that bypass owner auth. Reuses `getAvailableSlots()` directly — no new slot logic needed. Auth session is read optionally at the booking endpoint to determine CONFIRMED vs PENDING status.

## Architecture Decisions

### Decision: Landing page as Server Component with direct Prisma queries

| Option | Tradeoff | Decision |
|--------|----------|----------|
| RSC + direct Prisma | Zero API hop, SEO-friendly, streaming | **Chosen** |
| Client component + fetch /api/stores/public | Extra network request, worse SEO | Rejected |

The landing page fetches stores directly via Prisma in the Server Component. The `?specialty` searchParam drives a `contains` filter. No API call needed — same-process data access.

### Decision: Store page as hybrid RSC shell + client islands

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Full RSC | No interactivity for calendar/booking | Rejected |
| Full client | No SEO for store info | Rejected |
| RSC shell + client SlotCalendar + client BookingForm | Best of both | **Chosen** |

Server Component renders store info + business hours. `SlotCalendar` and `BookingForm` are `"use client"` components that call public API endpoints for slots and booking.

### Decision: Separate public API routes from owner routes

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Add public handlers to existing `/api/stores/[storeId]` | Confuses owner/public concerns, auth complexity | Rejected |
| New `/api/stores/public/` and `/api/stores/[slug]/` routes | Clean separation, slug-based public URLs | **Chosen** |

Public routes use slug-based lookup (not internal storeId). Owner routes remain unchanged with `assertOwnerAccess()`.

### Decision: Auth-optional booking endpoint

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Two endpoints (anonymous + authenticated) | Code duplication | Rejected |
| Single endpoint reads `auth()` optionally | One code path, status derived from session | **Chosen** |

`POST /api/stores/[slug]/book` calls `auth()`. If session exists → CONFIRMED + userId. If not → PENDING + clientEmail. No `requireAuth()` guard.

## Data Flow

```
LANDING (RSC)
  page.tsx → prisma.store.findMany() → StoreCard[]

STORE PAGE (Hybrid)
  [slug]/page.tsx → prisma.store.findUnique({slug}) → store info (RSC)
       │
       ├── SlotCalendar (client) → GET /api/stores/[slug]/slots?date=
       │                              → getAvailableSlots() → TimeSlot[]
       │
       └── BookingForm (client) → POST /api/stores/[slug]/book
                                    → auth() optional → prisma.appointment.create()

PERFIL (Client, auth-gated via proxy.ts)
  /perfil → GET /api/user/appointments → user's history
  /perfil/favoritos → GET/POST /api/user/favorites → toggle/list
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/page.tsx` | Modify | Replace starter with RSC landing: store list + specialty filter |
| `src/app/[slug]/page.tsx` | Create | Store detail: RSC shell with info + hours |
| `src/app/[slug]/SlotCalendar.tsx` | Create | Client Component: date picker + slot grid |
| `src/app/[slug]/BookingForm.tsx` | Create | Client Component: booking form (name/phone/email) |
| `src/app/perfil/page.tsx` | Create | Appointment history (client, auth-gated) |
| `src/app/perfil/favoritos/page.tsx` | Create | Favorites list with toggle (client, auth-gated) |
| `src/app/api/stores/public/route.ts` | Create | GET: list stores with avg rating + specialty filter |
| `src/app/api/stores/public/[slug]/route.ts` | Create | GET: store detail with avg rating |
| `src/app/api/stores/[slug]/slots/route.ts` | Create | GET: available slots for date (reuses getAvailableSlots) |
| `src/app/api/stores/[slug]/book/route.ts` | Create | POST: create appointment (auth-optional) |
| `src/app/api/user/appointments/route.ts` | Create | GET: authenticated user's appointment history |
| `src/app/api/user/favorites/route.ts` | Create | GET/POST: list/toggle favorite stores |
| `src/app/api/reviews/route.ts` | Create | POST: create review (auth + COMPLETED guard) |
| `src/components/ui/StarRating.tsx` | Create | Rating display component |
| `src/components/ui/StoreCard.tsx` | Create | Store card for landing page |
| `src/components/ui/SearchBar.tsx` | Create | Specialty filter input |
| `src/lib/stores.ts` | Modify | Add public query helpers (getPublicStores, getStoreBySlug) |

## Interfaces / Contracts

```typescript
// Public store listing response
interface PublicStore {
  id: string
  name: string
  slug: string
  specialty: string
  address: string
  averageRating: number
  reviewCount: number
}

// Store detail response (public)
interface PublicStoreDetail extends PublicStore {
  description: string | null
  phone: string | null
  timezone: string
  businessHours: { dayOfWeek: number; openTime: string; closeTime: string }[]
}

// Booking request
interface BookRequest {
  clientName: string
  clientPhone: string
  clientEmail: string
  dateTime: string  // ISO 8601
  service?: string
  notes?: string
}

// Review request
interface ReviewRequest {
  storeId: string
  rating: number    // 1-5
  comment?: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getAvailableSlots()` edge cases | Already tested in slots.ts; extend if needed |
| Integration | API route responses (public stores, slots, booking) | Manual + `next build` type check |
| E2E | Full booking flow (landing → store → book) | Post-Fase 6 with test runner setup |

No test runner is configured yet. Verification relies on `next build` (type safety) and manual testing.

## Threat Matrix

N/A — no routing middleware changes, no shell commands, no subprocess/VCS/PR automation, no executable-file classification, no process-integration boundary. The proxy.ts middleware already handles `/perfil/*` auth gating.

## Migration / Rollout

No migration required. All changes are additive (new routes, new pages, new API endpoints). The only modified file is `src/app/page.tsx` (starter page replacement). Rollback = revert PR.

## Open Questions

- None
