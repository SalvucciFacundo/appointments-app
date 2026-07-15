# Design: Auth & Role-Based Route Protection

## Technical Approach

Auth.js v5 with Google OAuth provider, JWT session strategy, and Next.js 16 `proxy.ts` for route protection. The Prisma schema already contains the required Auth.js models (User, Account, Session, VerificationToken) from Phase 1 — no schema changes needed. Role is injected into the JWT at sign-in time and surfaced via both `auth()` (server) and `useSession()` (client).

Maps to spec: `user-auth/spec.md` — all five requirements (Auth.js config, role injection, route protection, API handler, session provider) covered by this design.

## Architecture Decisions

| # | Decision | Choice | Alternatives Rejected | Rationale |
|---|----------|--------|-----------------------|-----------|
| 1 | Auth config structure | Single `src/auth.ts` | Split `auth.edge.ts` + `auth.ts` | Next.js 16 proxy runs on Node.js runtime (confirmed by docs: "Proxy defaults to using the Node.js runtime"). No Edge runtime = no need for split config. |
| 2 | Session strategy | JWT | Database sessions | JWT avoids a DB round-trip per request in proxy. Role changes are one-time events, not frequent enough to warrant DB sessions. Faster middleware execution. |
| 3 | Route protection file | `src/proxy.ts` | `src/middleware.ts` | Next.js 16 deprecates `middleware` and renames to `proxy`. The exported function must be named `proxy`. |
| 4 | Prisma client | Singleton in `src/lib/prisma.ts` | New client per import | Prevents connection exhaustion in dev (hot reload) and production. Standard pattern. |
| 5 | Default role | `USER` in JWT callback | `OWNER` or null | Matches Prisma schema default (`@default(USER)`). First-time Google login gets minimal privilege. |
| 6 | Seed data | No changes | Update seed with Auth.js linking | PrismaAdapter auto-links Google accounts by email. Seed users with matching emails will auto-connect. |

## Data Flow

```
Browser ──► Google OAuth ──► /api/auth/callback/google
                                    │
                                    ▼
                            PrismaAdapter creates/links
                            User + Account in DB
                                    │
                                    ▼
                            JWT callback:
                            reads user.role from DB
                            embeds in token (default: USER)
                                    │
                                    ▼
                            Session callback:
                            token.role ──► session.user.role
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                              ▼
              auth() [server]                useSession() [client]
              Server Components              Client Components
              Server Actions                 via SessionProvider
                     │
                     ▼
              proxy.ts [Node.js runtime]
              reads session from cookie
              enforces role-based access
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/auth.ts` | Create | Auth.js v5 config: PrismaAdapter, Google provider, JWT + session callbacks for role injection. Exports `auth`, `signIn`, `signOut`, `handlers`. |
| `src/proxy.ts` | Create | Exports `proxy` function wrapped with `auth()`. Checks `req.auth.session` for protected routes. Redirects unauthenticated → `/api/auth/signin`, wrong role → `/` or `/onboarding`. |
| `src/app/api/auth/[...nextauth]/route.ts` | Create | Re-exports `GET` and `POST` handlers from `src/auth.ts`. |
| `src/lib/prisma.ts` | Create | Singleton `PrismaClient` instance with global cache for dev hot-reload. |
| `src/components/SessionProvider.tsx` | Create | `"use client"` wrapper around `next-auth/react` SessionProvider. |
| `src/app/layout.tsx` | Modify | Wrap `{children}` with `<SessionProvider>`. |
| `package.json` | Modify | Add `next-auth` and `@auth/prisma-adapter` to dependencies. |
| `.env.local` | Modify | Add `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` placeholders with setup instructions in comments. |

## Interfaces / Contracts

### Extended Session Type (module augmentation)

```ts
// src/auth.ts — augment next-auth types
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role: "USER" | "OWNER" | "ADMIN";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "USER" | "OWNER" | "ADMIN";
  }
}
```

### Route Protection Rules (proxy.ts)

| Path Pattern | Required Role | No Session | Wrong Role |
|---|---|---|---|
| `/admin/*` | `ADMIN` | → `/api/auth/signin` | → `/` |
| `/dashboard/*` | `OWNER` | → `/api/auth/signin` | → `/onboarding` |
| `/perfil/*` | Any authenticated | → `/api/auth/signin` | — |

### Prisma Singleton

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | JWT callback assigns correct role | Mock Prisma, verify token shape |
| Unit | Session callback exposes role | Mock JWT token, verify session shape |
| Unit | proxy.ts redirects for each route/role combo | Use `unstable_doesProxyMatch` + mock `req.auth` |
| Integration | Google OAuth flow end-to-end | Manual: real Google credentials, verify user creation + role |
| E2E | Protected route access with different roles | Playwright: login as USER → verify `/admin` redirects to `/` |

## Threat Matrix

N/A — no routing infrastructure, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This is application-level auth with HTTP redirects only.

## Migration / Rollout

No migration required. The Prisma schema already has all Auth.js models. Auth.js auto-creates User/Account records on first Google login. Existing seed data is unaffected.

Rollout steps:
1. Install dependencies (`next-auth`, `@auth/prisma-adapter`)
2. Add env vars to `.env.local`
3. Create auth infrastructure files
4. Wrap layout with SessionProvider
5. Verify with `npx tsc --noEmit` and manual Google login

## Open Questions

- [ ] None — all decisions resolved from exploration phase.
