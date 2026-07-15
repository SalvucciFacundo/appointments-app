## Exploration: owner-portal

### Current State
The project has its foundation laid: Prisma schema with Store, BusinessHour, and BlockedDate models; Auth.js v5 with JWT and role-based protection via proxy.ts; and no existing API routes beyond auth. No dashboard or onboarding pages exist. The openspec.md defines the Owner Portal requirements in section 2.3 (onboarding flow + dashboard with settings, hours, blocked dates, cancelation policy).

### Affected Areas
- `src/proxy.ts` — Already redirects /dashboard/* to /onboarding for non-OWNERs. No changes needed.
- `src/app/layout.tsx` — May need a navigation bar update for authenticated users.
- `src/app/page.tsx` — Landing page, currently default Next.js scaffold. Unchanged for this phase.
- `prisma/schema.prisma` — Already complete with Store, BusinessHour, BlockedDate models. No migration needed.
- `src/auth.ts` — JWT role injection complete. No changes needed.
- `src/lib/prisma.ts` — Already configured with PrismaClient and pg adapter.
- `src/app/api/stores/` — NEW: API routes for store CRUD.
- `src/app/onboarding/` — NEW: Multi-step onboarding page.
- `src/app/dashboard/` — NEW: Dashboard with store settings, hours, blocked dates.
- `src/components/` — NEW: Shared form primitives (TextField, Select, etc.)

### Approaches

**1. API Architecture — Route Handlers**
Route Handlers (`route.ts` files in the App Router) for all CRUD operations.
- Pros: Standard Next.js pattern, clean separation, reusable by future clients, easy to test with Postman/curl
- Cons: More files to create, manual validation
- Effort: Medium

**2. Form Strategy — Hybrid: Server Component shell + Client Component forms**
Server Components provide the page layout, Client Components manage interactive form state with Server Actions for submission.
- Pros: Best UX for multi-step onboarding (state management across steps), real-time validation (slug uniqueness), Server Actions handle final persistence
- Cons: Two layers to coordinate, need to define clear boundary
- Effort: Medium

**3. Form Strategy — Pure Server Actions**
All forms use Server Actions with form actions, minimal client JS.
- Pros: Simpler mental model, less JS on client, canonical Next.js recommendation
- Cons: Poor UX for multi-step form (no live state), calendar picker and time inputs need client JS anyway
- Effort: Medium (but worse UX)

**4. Slug Generation — Auto slugify + user editable + uniqueness check**
Generate from store name: lowercase, replace special chars, trim. Let user edit in the form. Debounced check via API.
- Pros: Good UX, prevents URL conflicts
- Cons: Need debounced endpoint
- Effort: Low

### Recommendation

**Approach 1 + Approach 2 combined:**

Use **Route Handlers** for the CRUD API (`/api/stores/*`) — they give a clean contract that future clients (mobile apps, etc.) can consume, and keep business logic out of page files.

Use **Client Components with Server Actions** for the UI forms — the onboarding needs multi-step state (which is miserable in pure server form actions), while the final submit can call a Server Action that delegates to the same service layer the Route Handlers use.

Create a **shared form component library** at `src/components/ui/` — TextField, Select, Button, etc. — since multiple pages need form inputs and this avoids repetition.

For **slug generation**, auto-slugify from the name input with a debounced uniqueness check against a GET endpoint, and let the user override.

### Risks
- **Onboarding edge case**: User starts onboarding but doesn't finish. Current proxy redirects to /onboarding for non-OWNERs, so they'll see the form again. Need to handle partially created stores gracefully (check if user has a store with incomplete setup).
- **Timezone complexity**: The timezone field defaults to America/Argentina/Buenos_Aires. Multi-timezone handling is already in the spec but needs careful implementation in the dashboard.
- **No test runner configured**: The project has no testing setup. API routes would benefit from integration tests, but that's out of scope for this change.
- **Next.js 16**: The project uses Next.js 16.2.10 — need to check if there are any breaking changes in the App Router API route handling or Server Components patterns that differ from the well-known 14/15 conventions.

### Ready for Proposal
Yes — the codebase is well-prepared for this change. The Prisma schema is complete, auth is configured, and the proxy properly handles role-based redirects. The exploration clearly identifies what files to create and which approaches to use.
