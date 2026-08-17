# Design: Autenticación de usuarios (user-auth)

## Technical Approach

Migración aditiva de `users` + tabla `sessions`; login genera token aleatorio (SHA-256 en DB) y cookie httpOnly `session` + cookie legible `csrf_token`. Middleware global `Session` resuelve el actor (no bloquea anónimos); el grupo owner aplica `RequireAuth` (dual: sesión o `X-API-Key` → owner bootstrap), `RequireRole(OWNER)` y `CSRF`. Cada handler que recibe `storeID` pasa el actor al service, que verifica `stores.owner_id` (403 `forbidden`). Frontend: `credentials: "include"`, header `X-CSRF-Token` en mutaciones, `AuthProvider` + guard, páginas login/register, retiro total de `localStorage`.

## Architecture Decisions

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Sesión server-side vs JWT access+refresh | JWT: menos reads, pero revocación/rotación complejas y rol embebido obsoleto. Server-side: 1 read extra (aceptable), logout/revocación inmediata | **Server-side en PostgreSQL** (spec user-auth) |
| Argon2id vs bcrypt | bcrypt más común; Argon2id memory-hard, OWASP lo recomienda sobre bcrypt | **Argon2id** `golang.org/x/crypto/argon2` |
| CSRF double-submit simple vs token atado a sesión | Atado a sesión: 1 row más en DB, pero el header se valida contra el `csrf_token` persistido (no confía solo en cookie) | **Doble envío atado a sesión**: `csrf_token` en `sessions`, cookie legible espejo |
| Auto-login tras register | No lo pide la spec; UX pide un paso más | **Sin auto-login**; tras `201` el frontend redirige a `/login` |
| Bootstrap owner id | El stub usaba `OWNER_ID="dashboard-owner"`; tiendas existentes cuelgan de ese id. UUID nuevo dejaría el dashboard vacío | **Reusar `OWNER_ID` como id del bootstrap** (`EnsureBootstrapOwner`), preservando tiendas legacy |
| `RequireAPIKey` en rutas owner | Bloquea la transición | **Reemplazado** por `RequireAuth` dual; `RequireAPIKey` se elimina, se conserva `secureEqual` |
| CSRF en logout | Logout es mutación autenticada | **Protegido** cuando hay sesión; anónimo sigue siendo `204` |
| CORS `*` con credenciales | Inválido con cookies | **Prohibido**: si `origin == "*"` se omite `Access-Control-Allow-Origin` |

## Data Flow

```
Browser ──cookie session──▶ Session mw ──▶ Actor(ctx) ──▶ RateLimit (tier owner)
   │                                                              │
   └──X-CSRF-Token──▶ CSRF mw (valida vs sessions.csrf_token) ◀────┘
                              │
                    RequireAuth (401) → RequireRole(OWNER) (403)
                              │
                    handler → service (owner_id == actor.ID → 403)
                              │
                              ▼
                           store (pgx parametrizado)
```

Login: `service.Login` → `HashPassword` verificado con `VerifyPassword` → `CreateSession` → handler setea cookies. Cada request: `service.AuthenticateSession(raw)` → `sha256(raw)` → `GetActorByTokenHash` JOIN users.

## Modelo de datos

`backend/migrations/00002_user_auth.up.sql` (aditiva; `.down.sql` revierte):

```sql
ALTER TABLE users
  ADD COLUMN role text NOT NULL DEFAULT 'USER'
    CHECK (role IN ('USER','OWNER','ADMIN')),
  ADD COLUMN password_hash text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verification_token text;

CREATE TABLE sessions (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

Usuarios pre-existentes quedan `role='USER'`, `password_hash NULL` (spec `Migración de datos`). `EnsureOwnerUser` (legacy) es reemplazado por `EnsureBootstrapOwner`.

## Interfaces / Contracts

### Go — service

`backend/internal/service/password.go` (puras, testeables sin DB):
- `func HashPassword(password string, memory, time uint32) (string, error)` — formato `$argon2id$v=19$m=<mem>,t=<t>,p=4$<salt_b64>$<hash_b64>`, salt 16 bytes, keyLen 32, `p=4`.
- `func VerifyPassword(encoded, password string) error` — `subtle.ConstantTimeCompare`.
- `func NewToken() (string, error)` — 32 bytes `crypto/rand` → hex (cookie `session`).
- `func NewCSRFToken() (string, error)` — idem (cookie `csrf_token`).

`backend/internal/service/auth.go` (métodos sobre `*Service`):
- `Register(ctx, name, email, password string) (store.User, error)` — normaliza email lowercase, valida ≥8 chars, hashea, `role=USER` salvo `email == bootstrapEmail` → `OWNER`; `verification_token` = `NewToken()`; email duplicado → `ConflictError{Code:"email_taken"}`.
- `Login(ctx, email, password string) (store.User, SessionResult, error)` — `SessionResult{RawToken, CSRFToken string, ExpiresAt time.Time}`; credencial inválida o email inexistente → `ErrInvalidCredentials` (mismo mensaje).
- `Logout(ctx, rawToken string) error` — idempotente.
- `Me(ctx, actorID string) (store.User, error)`.
- `AuthenticateSession(ctx, rawToken string) (store.Actor, error)` — `sha256(rawToken)` → JOIN; vencida/ausente → `ErrUnauthorized`.
- `BootstrapOwner(ctx) (store.Actor, error)` — asegura user id=`bootstrapID`, email=`bootstrapEmail`, role OWNER, `password_hash NULL`.
- `CleanupExpiredSessions(ctx) error`.

`backend/internal/service/errors.go` — nuevos: `var ErrUnauthorized = errors.New("unauthorized")`, `var ErrForbidden = errors.New("forbidden")`, `var ErrInvalidCredentials = errors.New("invalid credentials")`. `handlers.respondError` mapea: `ErrUnauthorized`→401 `unauthorized`; `ErrForbidden`→403 `forbidden`; `ErrInvalidCredentials`→401 `invalid_credentials`.

`Service` recibe `service.Options{SessionTTL time.Duration; BootstrapID, BootstrapEmail string; Argon2Memory, Argon2Time uint32}` — `NewService(db, opts)`.

### Go — store

`backend/internal/store/users.go`: `Role` type + `RoleUser/RoleOwner/RoleAdmin`; `User{ID, Name, Email, Role string; EmailVerified bool}`; `Actor{ID, Name, Email, Role string}`; `CreateUser`, `GetUserByEmail`, `GetUserByID`, `EnsureBootstrapOwner(ctx, id, email)`, `IsUniqueViolation(err) bool` (pgconn 23505).

`backend/internal/store/sessions.go`: `Session{ID, UserID, TokenHash, CSRFToken string; ExpiresAt, CreatedAt time.Time}`; `CreateSession`, `GetActorByTokenHash(ctx, hash)` (JOIN users), `DeleteSessionByTokenHash`, `DeleteExpiredSessions`. Todas parametrizadas.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /api/auth/register` | `{name,email,password}` | `201 {id,name,email,role}` | `400` validation(field); `409` `email_taken`(email) |
| `POST /api/auth/login` | `{email,password}` | `200 {id,name,email,role}` + Set-Cookie `session` y `csrf_token` | `400`; `401` `invalid_credentials` |
| `POST /api/auth/logout` | — | `204` (idempotente) + cookie borradas | — |
| `GET /api/auth/me` | — | `200 {id,name,email,role}` | `401` `unauthorized` |

Cookies: `session` (HttpOnly, Secure si `COOKIE_SECURE`, SameSite=Lax, Path=/, Max-Age=`SESSION_TTL`) y `csrf_token` (idem sin HttpOnly).

### Go — handlers

`backend/internal/http/handlers/auth.go` → `Register/Login/Logout/Me`. `Handlers` pierde `ownerID`; recibe `cfg` (cookie secure + sessionTTL). `Handlers.Service` se extiende con: `Register, Login, Logout, Me, AuthenticateSession, BootstrapOwner`. Helpers `actorFromContext(r.Context())` / `withActor` (context key `actorKey`, definidos en `middleware/session.go`, reutilizados por handlers). Firmas owner pasan `actorID` como primer arg: `GetStore(ctx, actorID, id)`, `UpdateAppointmentStatus(ctx, actorID, storeID, apptID, action)`, etc.

### Go — middleware (`backend/internal/http/middleware/`)

| Archivo | Símbolo | Rol |
|---------|---------|-----|
| `session.go` | `Session(resolver SessionResolver)` | Lee cookie `session`, `AuthenticateSession`, inyecta `Actor` + `csrfToken` + flag `viaSession` en ctx. No bloquea anónimos. `SessionResolver{AuthenticateSession(ctx, raw) (store.Actor, error)}` |
| `requireauth.go` | `RequireAuth(bootstrap BootstrapResolver, apiKey string, disableAPIKey bool)` | Si no hay actor: API key válida y `!disableAPIKey` → `BootstrapOwner` + warning deprecación (`viaSession=false`); si no → 401 `unauthorized`. `BootstrapResolver{BootstrapOwner(ctx) (store.Actor, error)}` |
| `requirerole.go` | `RequireRole(role store.Role)` | Actor sin rol → 403 `forbidden` |
| `csrf.go` | `CSRF()` | Mutaciones (POST/PUT/PATCH/DELETE) con `viaSession` → header `X-CSRF-Token` == `csrf_token` del ctx (constant-time); ausente/inválido → 403 `csrf_invalid` |
| `ratelimit.go` | `RateLimit(isOwner func(*http.Request) bool)` | Reemplaza `apiKey string`; closure clasifica owner por actor o API key |
| `cors.go` | `CORS(origins)` | +`X-CSRF-Token` en `Allow-Headers`; `origin=="*"` → sin header |
| `requireapikey.go` | — | **Eliminado** (se conserva `secureEqual`) |

Cadena global: `CORS → Logging → Recover → Session → RateLimit`. Grupo auth: `logout` con `CSRF`. Grupo owner: `RequireAuth → RequireRole(OWNER) → CSRF → handlers`. `/api/auth/me` fuera del grupo owner (cualquier rol autenticado).

### Autorización por `owner_id` — endpoints actuales

| Endpoint (handler actual) | Cambio |
|---------------------------|--------|
| `GET /api/stores` `ListOwnerStores` | `ownerID` = actor.ID |
| `POST /api/stores` `CreateStore` | `ownerID` = actor.ID; rol OWNER vía middleware |
| `GET /api/stores/{id}` `GetStore` | verificar `st.OwnerID == actorID` → 403 |
| `PUT /api/stores/{id}` `UpdateStore` | idem |
| `PUT /api/stores/{id}/hours` `UpdateHours` | idem |
| `POST /api/stores/{id}/blocked-dates` `CreateBlockedDate` | idem |
| `DELETE /api/stores/{id}/blocked-dates/{bid}` `DeleteBlockedDate` | idem |
| `GET /api/stores/{id}/appointments` `ListAppointments` | idem |
| `POST /api/stores/{id}/appointments` `CreateAppointment` | idem |
| `PUT /api/stores/{id}/appointments/{aid}` `UpdateAppointmentStatus` | idem |
| `PUT /api/stores/{id}/appointments/{aid}/reschedule` `RescheduleAppointment` | idem |

La verificación vive en el service (usa `GetStoreByID` que ya devuelve `OwnerID`), no en el middleware de ruta.

### Config (`backend/internal/config/config.go`)

Nuevos campos/env: `SessionTTL` (`SESSION_TTL`, default `24h`), `CookieSecure` (`COOKIE_SECURE`, default `true`), `OwnerBootstrapEmail` (`OWNER_BOOTSTRAP_EMAIL`), `AuthDisableAPIKey` (`AUTH_DISABLE_API_KEY`, default `false`), `Argon2Memory` (`ARGON2_MEMORY`, default `65536`), `Argon2Time` (`ARGON2_TIME`, default `1`). `APIKey`/`OwnerID` se conservan (transición). Constantes `SessionCookie = "session"`, `CSRFCookie = "csrf_token"`.

## Frontend

| Archivo | Cambio |
|---------|--------|
| `src/api/client.ts` | `credentials: "include"` siempre; `apiKey` eliminado; mutaciones inyectan `X-CSRF-Token` desde cookie `csrf_token`; hook `onUnauthorized` (redirect a `/login`); `request` con `options.method` para no mutar el header en GET |
| `src/lib/cookies.ts` | `getCookie(name)` (nuevo) |
| `src/api/auth.ts` | `register/login/logout/me` (nuevo) |
| `src/api/types.ts` | `Role`, `User`, `LoginInput`, `RegisterInput` |
| `src/auth/AuthContext.tsx` | Provider: `user`, `loading`, `login`, `register`, `logout`; `me()` al montar; `useAuth()` (nuevo) |
| `src/auth/RequireAuth.tsx` | Guard: loading→spinner; sin user→`<Navigate to="/login"/>` (nuevo) |
| `src/pages/Login.tsx`, `src/pages/Register.tsx` | Formularios (copy UI en español) (nuevos) |
| `src/App.tsx` | `AuthProvider` + rutas `/login`, `/register`; `/dashboard` envuelto en `RequireAuth` |
| `src/pages/Dashboard.tsx` | Eliminar pantalla/estado de API key y `API_KEY_STORAGE`; datos vía sesión; botón logout |
| `src/api/stores.ts`, `src/api/appointments.ts` | Quitar parámetro `apiKey` de funciones owner |
| `src/components/appointments/{TodayAgenda,PendingQueue,DayCalendar,AppointmentDetail}.tsx` | Quitar prop `apiKey` |
| `src/api/client.test.ts` | Actualizar: `credentials`, header CSRF, manejo 401, sin localStorage |

## Sequence Diagrams

**Login:**

```
Browser            Go API                     Postgres
  │ POST /api/auth/login                     │
  │ {email,password} ──► handler ──► service ──► GetUserByEmail
  │                     service: VerifyPassword (argon2id)
  │                     service: CreateSession (token sha256, csrf)
  │ ◄─ 200 {profile} + Set-Cookie session (HttpOnly) + csrf_token
```

**Request autenticado con CSRF:**

```
Browser            Session mw   CSRF mw   RequireAuth  RequireRole  service
  │ cookie session ──► sha256 ──► GetActorByTokenHash (JOIN users)
  │ Actor en ctx ──────────────────────────────────────────────►
  │ POST + X-CSRF-Token ──► ¿cookie==header? (constant-time) ──► actor+OWNER
  │              ◄────── handler: GetStore(ctx, actor.ID, id) ──► owner_id check
  │ ◄─ 200 / 403 forbidden
```

**Transición dual con API key:**

```
Browser (legacy)          RequireAuth mw        Postgres
  │ GET /api/stores + X-API-Key ──► sin cookie session
  │                       ¿secureEqual(header, API_KEY)? → sí
  │                       AUTH_DISABLE_API_KEY=false → BootstrapOwner ──► user OWNER
  │                       warn "X-API-Key deprecated"
  │ ◄─ 200 (actor=bootstrap)
```

## Testing Strategy

| Layer | Qué probar | Cómo |
|-------|-----------|------|
| Unit (service) | `HashPassword`/`VerifyPassword` roundtrip y mismatch; `NewToken` longitud/aleatoriedad; `Register` normalización/validación/bootstrap role; `Login` 401 indistinguible; `AuthenticateSession` expirada; ownership → `ErrForbidden` | `service/password_test.go`, `auth_test.go` (fake store, sin DB) |
| Integration (http) | Códigos de error de `/auth/*`; transición dual; CSRF 403; 401/403 por rol; cookies seteadas | `handlers/auth_test.go`, `auth_router_test.go` (fake service, `httptest`); coexistencia `X-API-Key` + cookie |
| Middleware | `Session` actor vs anónimo; `RequireRole`; `CSRF` omitido/válido; RateLimit tier por actor | `middleware/middleware_test.go` (extender patrón actual) |
| Unit (frontend) | `request`: `credentials`, header CSRF, 401 handler, sin `apiKey`/localStorage; guard `RequireAuth` | Vitest: `client.test.ts` (actualizar), `auth.test.tsx` |
| E2E (manual smoke) | register→login→dashboard; logout; store ajeno → 403 | Script de verificación `make test` + Vitest |

## Threat Matrix

`N/A` — el cambio modifica rutas HTTP y agrega una goroutine de limpieza en-proceso, pero no toca shell commands, subprocesses, VCS/PR automation, ejecutables ni process-integration boundaries de la matriz (sus filas son `git -C`, push state, PR commands, documentation-like paths). No se fabrican tareas de amenazas.

## Migration / Rollout

1. Aplicar `00002_user_auth` (aditiva; pre-existentes intactos).
2. Backend: config + store users/sessions + service auth/password + handlers/middleware + ownership; **mantener** `X-API-Key` fallback (`AUTH_DISABLE_API_KEY=false`).
3. Frontend: cliente credentials/CSRF, auth store, guard, login/register, logout; **retirar** `localStorage` API key.
4. Validar dashboard con sesión en coexistencia (tests duales verdes).
5. `AUTH_DISABLE_API_KEY=true` cuando el stub no sea necesario.
6. **Rollback**: `AUTH_DISABLE_API_KEY=false` reactiva el stub sin revertir migraciones (tablas inertes); frontend mantiene sesión que el backend sigue aceptando. Kill switch = flag.

Limpieza: goroutine en `cmd/api/main.go` — `go func(){ t:=time.NewTicker(time.Hour); for { select { case <-ctx.Done(): return; case <-t.C: svc.CleanupExpiredSessions(ctx) } } }()`.

## Open Questions

- [ ] ¿Se quiere que `COOKIE_SECURE` default `true` rompa dev local http? (dev debe setear `COOKIE_SECURE=false`; documentar en `.env.example`)
- [ ] Confirmar que `OWNER_ID` legacy sea el id del bootstrap (recomendado para conservar tiendas) o generar id nuevo y migrar `stores.owner_id`.