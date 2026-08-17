# Tasks: Autenticación de usuarios (user-auth)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2100+ (migración + store + service + middleware + handlers + config + frontend completo + tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend core) → PR 2 (backend auth HTTP) → PR 3 (frontend) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migración + store users/sessions + service auth/password + config (main intacto, dual X-API-Key sigue activo) | PR 1 | `make test ./internal/service` | `make migrate-up` contra postgres dev | Revertir commit; migración aditiva inerte |
| 2 | Middleware session/role/csrf/ratelimit + handlers `/auth/*` + ownership por owner_id + wiring `main.go` | PR 2 | `make test ./internal/http/...` | docker-compose up + curl login→cookies→GET /api/stores | Revertir commit; `AUTH_DISABLE_API_KEY=false` restaura stub |
| 3 | Frontend: client credentials/CSRF, AuthProvider, login/register/logout, retiro de localStorage | PR 3 | `npm run test` | `npm run dev` + backend up | Revertir commit; frontend previo con X-API-Key sigue válido |

## Phase 1: Migración

- [x] 1.1 Crear `backend/migrations/00002_user_auth.up.sql`: `ALTER TABLE users` (role NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','OWNER','ADMIN')), password_hash, email_verified DEFAULT false, verification_token) + `CREATE TABLE sessions` (id, user_id FK CASCADE, token_hash UNIQUE, csrf_token, expires_at, created_at) + índices idx_sessions_user / idx_sessions_expires.
- [x] 1.2 Crear `backend/migrations/00002_user_auth.down.sql`: DROP TABLE sessions + ALTER users DROP COLUMN.
- [x] 1.3 Verificar `make migrate-up` / `make migrate-down`: filas users pre-existentes conservadas con role='USER', password_hash NULL. (Verificado vía psql aplicando el SQL exacto de up/down + goose Provider en DB throwaway; `make migrate-up` literal bloqueado por incompatibilidad pre-existente goose CLI vs naming `.up.sql`/`.down.sql` — ver apply-progress.)

## Phase 2: Store

- [x] 2.1 Crear `backend/internal/store/users.go`: types Role, RoleUser/RoleOwner/RoleAdmin, User{ID,Name,Email,Role,EmailVerified}, Actor{ID,Name,Email,Role}; CreateUser, GetUserByEmail, GetUserByID, EnsureBootstrapOwner, IsUniqueViolation (pgconn 23505); queries parametrizadas. (User además lleva PasswordHash con `json:"-"`, necesario para Login.)
- [x] 2.2 Crear `backend/internal/store/sessions.go`: Session{ID,UserID,TokenHash,CSRFToken,ExpiresAt,CreatedAt}; CreateSession, GetActorByTokenHash (JOIN users), DeleteSessionByTokenHash, DeleteExpiredSessions.

## Phase 3: Service

- [x] 3.1 Crear `backend/internal/service/password.go`: HashPassword (Argon2id m=65536, t=1, p=4, salt 16B, keyLen 32, formato `$argon2id$...`), VerifyPassword (subtle.ConstantTimeCompare), NewToken, NewCSRFToken (32 bytes hex).
- [x] 3.2 Crear `backend/internal/service/auth.go`: Register (normaliza email lowercase, password ≥8, role=USER salvo email==bootstrapEmail→OWNER, verif token=NewToken, duplicado→ConflictError email_taken), Login (SessionResult{RawToken,CSRFToken,ExpiresAt}, inválido→ErrInvalidCredentials), Logout idempotente, Me, AuthenticateSession (sha256→GetActorByTokenHash, vencida→ErrUnauthorized), BootstrapOwner (reusa OWNER_ID legacy), CleanupExpiredSessions.
- [x] 3.3 Ampliar `backend/internal/service/errors.go`: ErrUnauthorized, ErrForbidden, ErrInvalidCredentials.
- [x] 3.4 Ampliar `backend/internal/service/service.go`: Options{SessionTTL, BootstrapID, BootstrapEmail, Argon2Memory, Argon2Time}; NewService(db, opts) (variádico, retrocompatible); authStore interface para tests sin DB.
- [x] 3.5 `go get golang.org/x/crypto` + `go mod tidy`.

## Phase 4: Middleware

- [x] 4.1 Crear `backend/internal/http/middleware/session.go`: Session(SessionResolver), actorKey, withActor, actorFromContext; inyecta Actor + csrfToken + viaSession en ctx; no bloquea anónimos. (Resolver incluye `SessionCSRFToken` para inyectar el csrf_token del ctx — ver apply-progress.)
- [x] 4.2 Crear `backend/internal/http/middleware/requireauth.go`: RequireAuth(bootstrap BootstrapResolver, apiKey string, disableAPIKey bool) — sin actor y API key válida y !disable → BootstrapOwner + warning deprecación (viaSession=false); si no → 401 unauthorized.
- [x] 4.3 Crear `backend/internal/http/middleware/requirerole.go`: RequireRole(role store.Role) → 403 forbidden.
- [x] 4.4 Crear `backend/internal/http/middleware/csrf.go`: CSRF() — mutaciones (POST/PUT/PATCH/DELETE) con viaSession validan header X-CSRF-Token == csrf_token del ctx (constant-time); ausente/inválido → 403 csrf_invalid.
- [x] 4.5 Modificar `backend/internal/http/middleware/ratelimit.go`: RateLimit(isOwner func(*http.Request) bool) — closure clasifica por actor o API key (helper `IsOwner`).
- [x] 4.6 Modificar `backend/internal/http/middleware/cors.go`: Allow-Headers +X-CSRF-Token; origin "=="\*"" omite Access-Control-Allow-Origin.
- [x] 4.7 Eliminar `backend/internal/http/middleware/requireapikey.go`; conservar secureEqual en `secure.go` (exportado `SecureEqual`).

## Phase 5: Handlers + ownership

- [x] 5.1 Crear `backend/internal/http/handlers/auth.go`: Register/Login/Logout/Me; cookies session (HttpOnly, Secure si cfg.CookieSecure, SameSite=Lax, Path=/, Max-Age=TTL) y csrf_token.
- [x] 5.2 Modificar `backend/internal/http/handlers/respond.go`: mapear ErrUnauthorized→401 unauthorized, ErrForbidden→403 forbidden, ErrInvalidCredentials→401 invalid_credentials.
- [x] 5.3 Modificar `backend/internal/http/handlers/handlers.go`: quitar ownerID; Handlers recibe cfg (cookieSecure, sessionTTL); reusar actorFromContext (helper actorOrUnauthorized).
- [x] 5.4 Ampliar `backend/internal/service/stores.go` y `appointments.go`: firmas con actorID como primer arg y verificación stores.owner_id vía GetStoreByID → ErrForbidden (11 endpoints del design).
- [x] 5.5 Actualizar handlers stores.go/blocked_dates.go/hours.go/appointments.go: pasar actorID a GetStore, UpdateStore, UpdateHours, CreateBlockedDate, DeleteBlockedDate, ListAppointments, CreateAppointment, UpdateAppointmentStatus, RescheduleAppointment; ListOwnerStores/CreateStore con ownerID=actor.ID.

## Phase 6: Config + wiring

- [x] 6.1 Ampliar `backend/internal/config/config.go`: SessionTTL (SESSION_TTL default 24h), CookieSecure (COOKIE_SECURE default true), OwnerBootstrapEmail (OWNER_BOOTSTRAP_EMAIL), AuthDisableAPIKey (AUTH_DISABLE_API_KEY default false), Argon2Memory (ARGON2_MEMORY 65536), Argon2Time (ARGON2_TIME 1); const SessionCookie="session", CsrfCookie="csrf_token". APIKey/OwnerID se conservan.
- [x] 6.2 Actualizar `.env.example`: documentar COOKIE_SECURE=false en dev, SESSION_TTL, OWNER_BOOTSTRAP_EMAIL, AUTH_DISABLE_API_KEY.
- [x] 6.3 Modificar `cmd/api/main.go`: cadena global CORS→Logging→Recover→Session→RateLimit; grupo owner RequireAuth→RequireRole(OWNER)→CSRF; /api/auth/me fuera del grupo; logout con CSRF; goroutine CleanupExpiredSessions (ticker 1h, cancela con ctx). (Wiring de la cadena vive en `router.go`; `main.go` arma service.Options + la goroutine de limpieza.)

## Phase 7: Frontend API

- [x] 7.1 Crear `src/lib/cookies.ts`: getCookie(name).
- [x] 7.2 Ampliar `src/api/types.ts`: Role, User, LoginInput, RegisterInput.
- [x] 7.3 Modificar `src/api/client.ts`: credentials "include" siempre, eliminar apiKey/localStorage, mutaciones inyectan X-CSRF-Token desde cookie csrf_token, hook onUnauthorized (redirect /login), request con options.method.
- [x] 7.4 Crear `src/api/auth.ts`: register/login/logout/me.
- [x] 7.5 Quitar parámetro apiKey de `src/api/stores.ts` y `src/api/appointments.ts`.
- [x] 7.6 Quitar prop apiKey de `src/components/appointments/{TodayAgenda,PendingQueue,DayCalendar,AppointmentDetail}.tsx`.

## Phase 8: Frontend auth + pages

- [x] 8.1 Crear `src/auth/AuthContext.tsx`: AuthProvider (user, loading, login, register, logout; me() al montar), useAuth.
- [x] 8.2 Crear `src/auth/RequireAuth.tsx`: guard — loading→spinner, sin user→Navigate /login.
- [x] 8.3 Crear `src/pages/Login.tsx` y `src/pages/Register.tsx` (copy UI en español; register 201 → redirect /login).
- [x] 8.4 Modificar `src/App.tsx`: AuthProvider, rutas /login y /register, /dashboard envuelto en RequireAuth.
- [x] 8.5 Modificar `src/pages/Dashboard.tsx`: eliminar pantalla/estado de API key y API_KEY_STORAGE; botón logout.

## Phase 9: Tests + limpieza

- [x] 9.1 Crear `backend/internal/service/password_test.go` y `auth_test.go` (fake store, sin DB): roundtrip/mismatch hash, longitud NewToken, Register normalización/validación/duplicado/role bootstrap, Login indistinguible email/password, AuthenticateSession expirada→ErrUnauthorized. (Slice 1: parte de service completa. Slice 2: caso ownership→ErrForbidden agregado en appointments_test.go + BootstrapOwner devuelve el owner registrado con el email bootstrap.)
- [x] 9.2 Crear `backend/internal/http/handlers/auth_test.go` + `auth_router_test.go` (fake service, httptest): códigos /auth/* (201/409/401/204), cookies seteadas, transición dual X-API-Key+sesión, CSRF 403 csrf_invalid, USER→ruta owner 403.
- [x] 9.3 Extender `backend/internal/http/middleware/middleware_test.go`: Session actor vs anónimo, RequireRole, CSRF omitido/válido, RateLimit tier por actor.
- [x] 9.4 Actualizar `frontend/src/api/client.test.ts` (credentials include, header CSRF, manejo 401, sin localStorage) + crear `src/auth/auth.test.tsx` (guard redirige sin user).
- [x] 9.5 Verificación final: `make test`, `make vet`, `make lint`, `npm run test`, `npm run build`; smoke manual register→login→dashboard→logout y store ajeno→403. (Slice 3: `npm run test` 11/11 y `npm run build` OK; `make test`/`make vet` backend OK; `make lint` bloqueado por golangci-lint ausente en PATH — pre-existente; smoke manual E2E queda para la fase verify con backend arriba.)