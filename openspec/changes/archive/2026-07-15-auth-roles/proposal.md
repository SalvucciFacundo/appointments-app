# Proposal: Auth & Role-Based Route Protection

## Intent

The app has no authentication. Any user can access any route. We need Auth.js v5 with Google OAuth so that only authenticated users reach protected areas (`/admin/*`, `/dashboard/*`, `/perfil/*`), and their role (USER, OWNER, ADMIN) is available in both server and client contexts.

## Scope

### In Scope
- Auth.js v5 configuration (`src/auth.ts`) with PrismaAdapter + Google provider + JWT callbacks for role injection
- Route protection via `src/proxy.ts` (Next.js 16 convention, NOT middleware.ts)
- API route handler (`src/app/api/auth/[...nextauth]/route.ts`)
- SessionProvider wrapper for client-side session access
- Dependencies: `next-auth`, `@auth/prisma-adapter`
- `.env.local` documentation for AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

### Out of Scope
- Google Cloud Console OAuth setup (user performs manually)
- Custom login/logout UI pages (Auth.js default signin used)
- Onboarding flow for new OWNERs
- Role-based UI rendering beyond route-level gating
- OAuth credential provisioning

## Capabilities

### New Capabilities
- `user-auth`: Authentication via Google OAuth, session management, role injection into JWT/session, and route protection for authenticated areas.

### Modified Capabilities
- None

## Approach

1. Install `next-auth` and `@auth/prisma-adapter`
2. Create `src/auth.ts` — single config file with PrismaAdapter, Google provider, JWT callbacks that read `user.role` from DB and inject into `session.user.role`
3. Create `src/proxy.ts` — export `proxy()` function that checks `auth()` session, redirects unauthenticated requests to `/api/auth/signin`, and enforces role-based path rules
4. Create `src/app/api/auth/[...nextauth]/route.ts` — exports GET/POST handlers from Auth.js
5. Wrap root layout with `SessionProvider` for client component access
6. Add env var placeholders to `.env.local`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/auth.ts` | New | Auth.js v5 config with PrismaAdapter + Google + JWT callbacks |
| `src/proxy.ts` | New | Route protection (Next.js 16 proxy, not middleware) |
| `src/app/api/auth/[...nextauth]/route.ts` | New | API handler for Auth.js endpoints |
| `src/app/layout.tsx` | Modified | Wrap with SessionProvider |
| `package.json` | Modified | Add next-auth, @auth/prisma-adapter |
| `.env.local` | Modified | Add AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| proxy.ts vs middleware.ts confusion in Next.js 16 | Low | Exploration confirmed proxy.ts is correct; verified against Next.js 16 docs |
| Google OAuth credentials not configured before testing | High | Document setup steps; app gracefully shows signin page when credentials missing |
| JWT callback fails if user not yet in DB (first Google login) | Medium | PrismaAdapter auto-creates Account/User; callback handles null role by defaulting to USER |

## Rollback Plan

1. Remove `src/auth.ts`, `src/proxy.ts`, `src/app/api/auth/[...nextauth]/route.ts`
2. Revert `src/app/layout.tsx` SessionProvider wrapper
3. Remove `next-auth` and `@auth/prisma-adapter` from `package.json`
4. No database changes to revert (schema already has auth models from Phase 1)

## Dependencies

- Google Cloud Console OAuth 2.0 credentials (user provides GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
- AUTH_SECRET generated via `openssl rand -base64 32`

## Success Criteria

- [ ] `npm run dev` starts without errors
- [ ] Unauthenticated access to `/admin`, `/dashboard`, `/perfil` redirects to signin
- [ ] Google OAuth login creates/finds user and returns session with role
- [ ] `auth()` returns session with `user.role` in server components
- [ ] `useSession()` returns session with `user.role` in client components
- [ ] `npx tsc --noEmit` passes with zero errors
