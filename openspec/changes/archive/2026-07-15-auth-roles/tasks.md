# Tasks: Auth & Role-Based Route Protection

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~130 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core Auth Setup

- [x] 1.1 Install `next-auth` and `@auth/prisma-adapter` to `package.json` dependencies
- [x] 1.2 Create `src/lib/prisma.ts` — PrismaClient singleton with global dev cache
- [x] 1.3 Create `src/auth.ts` — Auth.js v5 config with PrismaAdapter, Google provider, JWT callback (role injection), session callback (role exposure), and module augmentation for `Session.user.role` and `JWT.role`
- [x] 1.4 Create `src/app/api/auth/[...nextauth]/route.ts` — re-export `GET` and `POST` from `src/auth.ts`

## Phase 2: Route Protection

- [x] 2.1 Create `src/proxy.ts` — export `proxy()` wrapped with `auth()`; `/admin/*` → ADMIN, `/dashboard/*` → OWNER, `/perfil/*` → any auth; redirect unauthenticated to `/api/auth/signin`, wrong role to `/` or `/onboarding`
- [x] 2.2 Create `src/components/SessionProvider.tsx` — `"use client"` wrapper around `SessionProvider` from `next-auth/react`
- [x] 2.3 Modify `src/app/layout.tsx` — wrap `{children}` with `<SessionProvider>`
- [x] 2.4 Add `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` to `.env.local` with setup instructions

## Phase 3: Verify

- [x] 3.1 `npx tsc --noEmit` — verify TypeScript compiles cleanly
- [x] 3.2 `npm run build` — verify Next.js build passes
- [x] 3.3 Verify `proxy.ts` exports match Next.js 16 conventions (named export `proxy`, Node.js runtime)
