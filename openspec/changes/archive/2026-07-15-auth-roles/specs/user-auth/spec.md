# user-auth Specification

## Purpose

Authentication and role-based route protection for the Appointments app. Auth.js v5 with Google OAuth provides identity; JWT carries the user's role; `proxy.ts` enforces access rules per route prefix.

## Requirements

### Requirement: Auth.js Configuration

The system MUST configure Auth.js v5 (`src/auth.ts`) with `PrismaAdapter`, the Google provider, and `jwt` strategy. The configuration MUST export a single `auth` object consumable by both the API handler and the proxy.

#### Scenario: Valid Auth.js bootstrap

- GIVEN `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are set in environment
- WHEN the application starts
- THEN Auth.js initializes without errors and exposes `auth()`, `signIn()`, `signOut()`, and handlers

#### Scenario: Missing environment variables

- GIVEN one or more required auth environment variables are absent
- WHEN the application starts
- THEN Auth.js logs a configuration error and the signin page renders a graceful failure message

### Requirement: Role Injection

The JWT callback MUST read the user's `role` from the database and embed it in the JWT token. The session callback MUST expose `token.role` as `session.user.role`. If the user has no role assigned, the callback MUST default to `USER`.

#### Scenario: Authenticated user with OWNER role

- GIVEN a user with `role: OWNER` in the database signs in via Google
- WHEN the JWT callback executes
- THEN the token contains `role: OWNER`
- AND the session callback exposes `session.user.role` as `OWNER`

#### Scenario: First-time Google login (no prior role)

- GIVEN a Google account not yet linked to any user record
- WHEN the user signs in for the first time
- THEN PrismaAdapter creates the User record
- AND the JWT callback assigns `role: USER` as default

### Requirement: Route Protection

The system MUST export a `proxy()` function from `src/proxy.ts` that intercepts requests and enforces access rules. Unauthenticated requests to protected routes MUST redirect to `/api/auth/signin`.

| Path Pattern | Required Role | No-Role Behavior |
|---|---|---|
| `/admin/*` | `ADMIN` | Redirect to `/` |
| `/dashboard/*` | `OWNER` | Redirect to `/onboarding` |
| `/perfil/*` | Any authenticated user | Redirect to `/api/auth/signin` |

#### Scenario: Unauthenticated user accesses /dashboard

- GIVEN no active session exists
- WHEN the user requests `/dashboard`
- THEN the proxy redirects to `/api/auth/signin`

#### Scenario: USER role accesses /admin

- GIVEN an authenticated user with `role: USER`
- WHEN the user requests `/admin/settings`
- THEN the proxy redirects to `/`

#### Scenario: OWNER accesses /dashboard

- GIVEN an authenticated user with `role: OWNER`
- WHEN the user requests `/dashboard`
- THEN the request proceeds normally

#### Scenario: OWNER without role accesses /dashboard

- GIVEN an authenticated user with no role assigned (null)
- WHEN the user requests `/dashboard`
- THEN the proxy redirects to `/onboarding`

### Requirement: API Route Handler

The system MUST provide GET and POST handlers at `src/app/api/auth/[...nextauth]/route.ts` that delegate to Auth.js.

#### Scenario: OAuth callback

- GIVEN the user completes Google OAuth consent
- WHEN Google redirects to `/api/auth/callback/google`
- THEN Auth.js processes the callback, creates/updates the user, and redirects to the app

### Requirement: Session Provider

The root layout SHOULD wrap the application with `SessionProvider` so client components can access session data via `useSession()`.

#### Scenario: Client component reads session

- GIVEN a user is authenticated
- WHEN a client component calls `useSession()`
- THEN it receives the session object including `user.role`
