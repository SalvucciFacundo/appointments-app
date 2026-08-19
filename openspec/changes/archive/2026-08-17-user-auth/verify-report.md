```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:079349d6f5fdc7605cef1236ad88c461e26f43ba29bda67eb6e9ac325398ef13
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 18/18
scenarios: 32/32
test_command: cd backend && make test (go test -count=1 ./...) && cd frontend && npm run test
test_exit_code: 0
test_output_hash: sha256:9a651e7f08ca4886259b322adf5d9d9299141fd8452e6d48b6c0036016995250
build_command: cd backend && make build (go build ./...) && cd frontend && npm run build (tsc && vite build)
build_exit_code: 0
build_output_hash: sha256:0209d47af3b8207d03d41e960f26e4518702b63d3132e8a677472465998cb9dc
```

# Verificación SDD — user-auth (Autenticación de usuarios)

**Change**: user-auth
**Version**: N/A (delta specs de 2026-08-17)
**Mode**: Standard (strict_tdd=false en `openspec/config.yaml`)
**Rama**: `feat/user-auth-03-frontend` (base de la cadena `feat/user-auth-01` → `02` → `03`)
**Método**: Revisión de specs → diseño → código + ejecución real de tests, build y smoke E2E contra PostgreSQL throwaway.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 41 |
| Tasks complete | 41 |
| Tasks incomplete | 0 |

Todas las tareas marcadas `[x]` en `openspec/changes/user-auth/tasks.md` (3 slices: backend core, backend auth HTTP, frontend). Sin tareas pendientes: verify completo procede.

## Build & Tests Execution

**Build (backend)**: ✅ Passed — `make build` exit 0.
**Build (frontend)**: ✅ Passed — `tsc && vite build` exit 0 (301.40 kB JS, 42.46 kB CSS).
**Tests (backend)**: ✅ 120 tests en 3 paquetes, exit 0 (`go test -count=1 ./...`, sin caché).
**Tests (frontend)**: ✅ 11 tests (2 archivos), exit 0 (`npm run test` — vitest 3.2.7).
**Vet**: ✅ `make vet` exit 0.
**go mod tidy**: ✅ sin cambios (`GO_MOD_TIDY_CLEAN=yes`).
**Lint**: ⚠️ NO ejecutado — `golangci-lint` no está en PATH. **WARNING pre-existente** (no introducido por este cambio; documentado también en tasks.md 9.5 y en el verify de migración anterior).

```text
# backend
ok  github.com/salvuccifacundo/appointments-app/backend/internal/http/handlers  0.005s
ok  github.com/salvuccifacundo/appointments-app/backend/internal/http/middleware  0.002s
ok  github.com/salvuccifacundo/appointments-app/backend/internal/service  0.218s
# frontend
Test Files  2 passed (2)
Tests  11 passed (11)
# build frontend
✓ built in 1.13s
```

**Coverage**: no umbral configurado (`coverage_threshold: 0`) → ➖ No aplica.

## Migraciones (goose single-file)

Verificadas contra DB throwaway `appts_verify_auth` con goose v3.27.3:

- `goose up`: `OK 00001_init.sql` + `OK 00002_user_auth.sql` → version 2. Exit 0. **El formato single-file (directivas `-- +goose Up`/`-- +goose Down` en un único archivo) funciona** (el slice 1 lo arregló; previamente goose v3.27.3 paniqueaba con "duplicate version" por el naming `.up.sql`/`.down.sql`).
- `goose down`: `OK 00002_user_auth.sql` → version 1; `sessions` y columnas nuevas eliminadas. Exit 0.
- **No destructiva**: con `down` aplicado, inserté un usuario legacy (`legacy-1`, sin credenciales) y una store (`s-legacy`); tras `up`, el usuario se conserva con `role='USER'`, `password_hash=NULL`, `email_verified=f`, y la store sigue existiendo. Requisito 14 PASS con evidencia real.

## Smoke E2E real (backend con DB throwaway, `COOKIE_SECURE=false`, `API_KEY=dummy`, `OWNER_BOOTSTRAP_EMAIL=owner@example.com`, `PORT=8099`)

| Paso | Esperado | Obtenido | Resultado |
|------|----------|----------|-----------|
| POST /api/auth/register (USER) | 201, role USER | `201 {"role":"USER","email":"ana@example.com"}` (email normalizado desde `Ana@Example.com`) | ✅ |
| POST /api/auth/register (bootstrap) | 201, role OWNER | `201 {"role":"OWNER","email":"owner@example.com"}` | ✅ |
| POST /api/auth/register duplicado | 409 email_taken | `409 {"error":{"code":"email_taken",...}}` | ✅ |
| POST /api/auth/login | 200 + cookies | `200` + `Set-Cookie: session=...; HttpOnly; SameSite=Lax` (sin `Secure` con COOKIE_SECURE=false) + `Set-Cookie: csrf_token=...; SameSite=Lax` | ✅ |
| GET /api/auth/me (con sesión) | 200 | `200 {"role":"USER",...}` | ✅ |
| GET /api/auth/me (anónimo) | 401 | `401 {"error":{"code":"unauthorized",...}}` | ✅ |
| Login email inexistente | 401 invalid_credentials | `401 {"error":{"code":"invalid_credentials","message":"invalid email or password"}}` | ✅ |
| Login password incorrecto | 401 invalid_credentials, idéntico mensaje | `401` con exactamente el mismo code y message | ✅ (indistinguible) |
| USER → GET /api/stores | 403 forbidden | `403 {"error":{"code":"forbidden",...}}` | ✅ |
| GET /api/stores + X-API-Key: dummy | 200 + warning | `200 []` + log `WARN X-API-Key is deprecated; use cookie sessions path=/api/stores` | ✅ |
| POST /api/stores sin X-CSRF-Token | 403 csrf_invalid | `403 {"error":{"code":"csrf_invalid",...}}` | ✅ |
| POST /api/stores con X-CSRF-Token | 201 | `201` con store creada, `ownerId` = id del OWNER de sesión | ✅ |
| POST /api/auth/logout | 204 | `204` + cookies expiradas | ✅ |
| GET /api/auth/me tras logout | 401 | `401 unauthorized` (sesión revocada) | ✅ |
| X-API-Key con AUTH_DISABLE_API_KEY=true | 401 | `401 unauthorized` | ✅ |
| Sin credenciales | 401 | `401 unauthorized` | ✅ |
| Preflight OPTIONS origin permitido | 204 + CORS exacto | `Access-Control-Allow-Origin: http://localhost:5173`, `Allow-Credentials: true`, `Allow-Headers: Content-Type, X-API-Key, X-CSRF-Token` (sin `*`) | ✅ |
| Origin no permitido | sin headers CORS | sin `Access-Control-Allow-*` | ✅ |
| Exceso de rate limit anónimo | 429 + Retry-After | `429 {"error":{"code":"rate_limited",...}}` + `Retry-After: 23` | ✅ |

**Sesión en DB**: la tabla `sessions` guarda `token_hash` (hex SHA-256 de 64 chars), nunca el token crudo; `csrf_token` atado a la sesión; `expires_at` futuro. Verificado por SQL directo en la DB throwaway.

**CORS sin comodín**: con `origin=="*"` el middleware omite `Access-Control-Allow-Origin` (ver `cors.go`), conforme al diseño.

## Spec Compliance Matrix

### Spec `user-auth` (13 ADDED, 19 escenarios)

| Requirement | Scenario | Test/Evidencia | Result |
|-------------|----------|----------------|--------|
| Registro con email y password | Registro exitoso | `service/auth_test.go > TestRegister_SuccessNormalizesEmailAndHashesPassword`, `handlers/auth_test.go > TestRegister_SuccessReturns201Profile` + smoke 201 | ✅ COMPLIANT |
| Registro con email y password | Email duplicado | `TestRegister_DuplicateEmailReturnsConflict`, `TestRegister_DuplicateEmail409` + smoke 409 | ✅ COMPLIANT |
| Registro con email y password | Password inválido | `TestRegister_ValidationErrors` (FieldError field=password, no crea user) + smoke | ✅ COMPLIANT |
| Login con sesión server-side | Login válido | `TestLogin_SuccessCreatesSession` (token 64 hex, SHA-256 en DB, expires ~24h), `TestLogin_SuccessSetsSessionAndCSRFCookies` (cookies) + smoke | ✅ COMPLIANT |
| Login con sesión server-side | Password incorrecto | `TestLogin_UnknownEmailAndWrongPasswordAreIndistinguishable` + smoke | ✅ COMPLIANT |
| Logout | Logout con sesión | `TestLogout_Idempotent`, `TestLogout_NoContentAndClearsCookies`, `TestLogout_RequiresCSRFWithSessionButAnonymousStays204` + smoke 204→401 | ✅ COMPLIANT |
| Perfil actual (/api/auth/me) | Me autenticado | `TestMe_AuthenticatedReturnsProfile` + smoke 200 | ✅ COMPLIANT |
| Perfil actual (/api/auth/me) | Me anónimo | `TestMe_Anonymous401` + smoke 401 | ✅ COMPLIANT |
| Middleware de sesión | Sesión vencida | `TestAuthenticateSession_ExpiredReturnsUnauthorized` (service), `TestSession_InvalidSessionStaysAnonymous` (middleware) | ✅ COMPLIANT |
| Middleware de rol | USER accede a ruta owner | `TestUserActor_OwnerRouteForbidden`, `TestRequireRole_ForbidsDifferentRole` + smoke 403 | ✅ COMPLIANT |
| Autorización por owner_id | OWNER accede a store ajeno | `service/appointments_test.go > TestOwnerScoped_ForbiddenForForeignStore` (GetStore, UpdateStore, UpdateHours, ListAppointments, CreateBlockedDate, DeleteBlockedDate, CreateAppointment → ErrForbidden) | ✅ COMPLIANT |
| Bootstrap de OWNER | Registro con email de bootstrap | `TestRegister_BootstrapEmailGetsOwnerRole`, `TestBootstrapOwner_ReturnsRegisteredOwnerForBootstrapEmail` + smoke 201 OWNER | ✅ COMPLIANT |
| Bootstrap de OWNER | Creación de tienda sin promoción | `TestUserActor_OwnerRouteForbidden` (USER bloqueado por RequireRole antes del handler) + inspección de `store/stores.go > EnsureOwnerUser` (`INSERT ... ON CONFLICT DO NOTHING`, sin promoción) | ✅ COMPLIANT |
| Protección CSRF | Mutación sin token CSRF | `TestOwnerMutation_WithoutCSRFTokenForbidden`, `TestCSRF_SessionMutationWithoutTokenForbidden` + smoke 403 csrf_invalid | ✅ COMPLIANT |
| Transición dual con X-API-Key | Fallback a API key | `TestDualTransition_OwnerRouteWithAPIKeyOnly`, `TestRequireAuth_ValidKeyMapsToBootstrapActor` + smoke 200 + warning | ✅ COMPLIANT |
| Transición dual con X-API-Key | API key deshabilitada | `TestRequireAuth_DisabledAPIKeyReturns401` + smoke 401 | ✅ COMPLIANT |
| Booking anónimo PENDING | Reserva anónima | `service/booking.go > Book` intacto (crea `StatusPending`, sin parámetros de auth); `TestBook_HappyPath` | ✅ COMPLIANT |
| Migración de datos | Usuario pre-existente | goose up/down E2E con usuario legacy conservado (role USER, password_hash NULL) + task 1.3 | ✅ COMPLIANT |
| Tests de autenticación | Pruebas de transición dual | Suite `TestDualTransition_*` (API key + sesión en coexistencia) + Vitest `client.test.ts` (credentials, CSRF, 401, sin localStorage) | ✅ COMPLIANT |

### Spec `owner-portal` (1 MODIFIED + 1 ADDED, 6 escenarios)

| Requirement | Scenario | Test/Evidencia | Result |
|-------------|----------|----------------|--------|
| Owner authentication via API key stub (MODIFIED) | Dashboard autenticado por sesión | `TestDualTransition_OwnerSessionOnOwnerRoute` + smoke | ✅ COMPLIANT |
| Owner authentication via API key stub | Sin sesión ni API key | `TestOwnerRoute_NoCredentials401` + smoke 401 | ✅ COMPLIANT |
| Owner authentication via API key stub | Transición dual con API key | `TestDualTransition_OwnerRouteWithAPIKeyOnly` + smoke 200 + warning | ✅ COMPLIANT |
| Owner authentication via API key stub | API key deshabilitada | `TestRequireAuth_DisabledAPIKeyReturns401` + smoke 401 | ✅ COMPLIANT |
| Guard de ruta del dashboard (ADDED) | Usuario no autenticado accede a /dashboard | `auth/auth.test.tsx > redirects to /login when there is no authenticated user` | ✅ COMPLIANT |
| Guard de ruta del dashboard | OWNER accede a /dashboard | `auth/auth.test.tsx > renders children for an authenticated user` | ✅ COMPLIANT |

### Spec `go-api` (3 MODIFIED, 7 escenarios)

| Requirement | Scenario | Test/Evidencia | Result |
|-------------|----------|----------------|--------|
| JSON error contract (MODIFIED) | Error de sesión | `TestOwnerRoute_NoCredentials401`, `TestMe_Anonymous401`, `TestAuthenticateSession_ExpiredReturnsUnauthorized` (401 unauthorized) | ✅ COMPLIANT |
| JSON error contract | Rol insuficiente | `TestUserActor_OwnerRouteForbidden`, `TestRequireRole_ForbidsDifferentRole` (403 forbidden) | ✅ COMPLIANT |
| API key stub for owner routes (MODIFIED) | Ruta owner con sesión válida | `TestDualTransition_OwnerSessionOnOwnerRoute` | ✅ COMPLIANT |
| API key stub for owner routes | Ruta owner sin credenciales | `TestOwnerRoute_NoCredentials401` + smoke | ✅ COMPLIANT |
| API key stub for owner routes | Fallback con API key válida | `TestDualTransition_OwnerRouteWithAPIKeyOnly` + smoke | ✅ COMPLIANT |
| CORS and rate limiting (MODIFIED) | Sesión owner excede el rate limit | `TestRateLimit_OwnerGetsHigherLimit`, `TestRateLimit_OwnerTierBySessionActor` (tier 30/min por actor) | ✅ COMPLIANT |
| CORS and rate limiting | Anónimo en endpoint de auth | `TestRateLimit_Anonymous429WithRetryAfter` + smoke 429 con `Retry-After` | ✅ COMPLIANT |

**Compliance summary**: 32/32 escenarios compliant (18/18 requirements).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Registro normaliza email, password ≥8, role=USER salvo bootstrap, 409 email_taken | ✅ Implemented | `service/auth.go > Register`; email lowercase+trim, FieldError, `ConflictError{email_taken}` vía `IsUniqueViolation` (23505) |
| Login indistinguible | ✅ Implemented | `Login` mapea `pgx.ErrNoRows` y password inválido al mismo `ErrInvalidCredentials` |
| Sesión: SHA-256 en DB, cookie httpOnly Secure SameSite=Lax, expiración | ✅ Implemented | `auth.go > sha256Hex`; `handlers/auth.go > setSessionCookies` (HttpOnly, Secure condicional, SameSite=Lax, Max-Age=TTL); `store/sessions.go > GetActorByTokenHash` filtra `expires_at > now()` |
| Logout idempotente 204 + cookie limpiada | ✅ Implemented | `Logout` no-op con token vacío/desconocido; `clearSessionCookies` |
| Me 200/401 | ✅ Implemented | `Me` usa `ActorFromContext`; anónimo → 401 |
| Middleware sesión 401 vencida; rol 403 | ✅ Implemented | `middleware/session.go`, `middleware/requirerole.go` |
| Ownership por owner_id (11 endpoints) | ✅ Implemented | `service/stores.go > requireStoreOwnership` (GetStoreByID → `OwnerID != actorID` → ErrForbidden); aplicado en GetStore, UpdateStore, ReplaceBusinessHours, CreateBlockedDate, DeleteBlockedDate, ListAppointments, CreateAppointment, UpdateAppointmentStatus, RescheduleAppointment + ListStoresByOwner/CreateStore scoped al actor |
| Bootstrap OWNER explícito, sin auto-promoción | ✅ Implemented | Role OWNER solo vía `email==BootstrapEmail` o `EnsureBootstrapOwner`; `EnsureOwnerUser` legacy hace `INSERT ... ON CONFLICT DO NOTHING` (no promueve) |
| CSRF doble envío atado a sesión | ✅ Implemented | `middleware/csrf.go` valida header vs `csrfFromContext` (token persistido en `sessions.csrf_token`) con `subtle.ConstantTimeCompare`; mutaciones con viaSession |
| Transición dual sesión>API key, AUTH_DISABLE_API_KEY | ✅ Implemented | `middleware/requireauth.go`: sesión gana, fallback con warning, flag lo deshabilita |
| Booking anónimo PENDING | ✅ Implemented | `service/booking.go > Book` sin auth |
| CORS exacto + credenciales sin `*`; rate limit tiers | ✅ Implemented | `middleware/cors.go` (origin exacto, Allow-Credentials, `*` omite header), `middleware/ratelimit.go` (10/30 por minuto, Retry-After) |
| Frontend: credentials, CSRF header, 401→/login, guard, logout, sin localStorage | ✅ Implemented | `frontend/src/api/client.ts` (credentials include, X-CSRF-Token en mutaciones, onUnauthorized→redirectToLogin), `auth/RequireAuth.tsx` (guard + Navigate /login), `pages/Dashboard.tsx` (logout), grep residual de localStorage/apiKey solo en tests negativos |
| Migración aditiva no destructiva | ✅ Implemented | `migrations/00002_user_auth.sql` + goose up/down verificado E2E |

## Coherence (Design)

| Decisión (design.md) | Seguida? | Notas |
|----------------------|----------|-------|
| Sesión server-side en PostgreSQL | ✅ Sí | `sessions` + `GetActorByTokenHash` JOIN users |
| Argon2id | ✅ Sí | `service/password.go` (m=65536, t=1, p=4, formato `$argon2id$`) |
| CSRF doble envío atado a sesión | ✅ Sí | `sessions.csrf_token` + header validado en middleware |
| Sin auto-login tras register | ✅ Sí | Frontend redirige a `/login` tras 201 (`Register.tsx`) |
| Reusar OWNER_ID como id del bootstrap | ✅ Sí | `EnsureBootstrapOwner(ctx, BootstrapID, BootstrapEmail)` |
| RequireAPIKey reemplazado por RequireAuth dual | ✅ Sí | `requireapikey.go` eliminado; `secureEqual` conservado en `secure.go` como `SecureEqual` |
| CSRF en logout | ✅ Sí | `r.With(middleware.CSRF()).Post("/logout", ...)`; anónimo sigue 204 |
| CORS `*` prohibido con credenciales | ✅ Sí | `hasWildcardOrigin` omite el header |
| Cadena global CORS→Logging→Recover→Session→RateLimit | ✅ Sí | `router.go` |
| Grupo owner RequireAuth→RequireRole(OWNER)→CSRF | ✅ Sí | `router.go` |
| `/api/auth/me` fuera del grupo owner | ✅ Sí | `router.go` |
| Goroutine CleanupExpiredSessions (ticker 1h, cancela con ctx) | ✅ Sí | `cmd/api/main.go` |

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. `make lint` no puede ejecutarse: `golangci-lint` no está en PATH. **Pre-existente** (también bloqueado en la migración React+Go), no introducido por este cambio. No es un fallo del cambio.
2. El rate limiter clasifica por IP (`clientID` confía en el primer hop de `X-Forwarded-For` sin validar) — comportamiento heredado del helper TypeScript original, fuera del alcance de este cambio.

**SUGGESTION**:
1. El rate limit anónimo (10/min) también aplica a `POST /api/auth/login` y `/api/auth/register`, lo que permite bloquear el login de un usuario real desde una misma IP compartida (NAT). La spec go-api lo exige explícitamente (escenario "Anónimo en endpoint de auth"), así que es conforme; considerar whitelist por cuenta o limiter por email en una iteración futura.
2. `EnsureOwnerUser` (legacy, `INSERT ... ON CONFLICT DO NOTHING`) queda como código muerto funcional en la práctica: el grupo owner exige OWNER, y el bootstrap ya crea la fila. Podría eliminarse en limpieza futura.

## Verdict

**PASS WITH WARNINGS**

41/41 tasks completas, 32/32 escenarios compliant, build y tests verdes en backend (120 tests) y frontend (11 tests), smoke E2E completo contra DB throwaway verificado end-to-end (register/login/me/403/dual/CSRF/logout/401, migración no destructiva, CORS, rate limit con Retry-After). Los warnings son pre-existentes (golangci-lint ausente) o heredados del comportamiento de rate limiting; ninguno rompe spec ni diseño.