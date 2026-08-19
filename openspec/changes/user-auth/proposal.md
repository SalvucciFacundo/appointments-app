# Propuesta: Autenticación de usuarios (user-auth)

## Intent

Reemplazar el stub de un único dueño (`X-API-Key` + `OWNER_ID` fijo) por autenticación real de email/password con sesiones server-side en cookie httpOnly, roles y autorización por `owner_id`, manteniendo el booking anónimo y una transición dual reversible.

## Motivation

El stub actual no puede probar quién es el dueño de cada petición: `OWNER_ID` es un valor fijo del config, el dashboard guarda la API key en `localStorage` (exponible por XSS) y no existe registro, login, logout ni rol. Sin identidad real no hay multitenancy seguro: cualquier cambio futuro de permisos sería IDOR.

## Scope

### In Scope
- Migración: ampliar `users` (role, password_hash) + tabla `sessions` (token hasheado, expiración) y `email_verified`/`verification_token` sin verificación funcional.
- API: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Middleware de sesión (cookie) + middleware de rol; autorización por `owner_id` en **cada** endpoint que recibe `storeID`.
- Bootstrap explícito de `OWNER` por `OWNER_BOOTSTRAP_EMAIL` (no promoción automática).
- Frontend: cliente API con `credentials: "include"`, manejo de `401`, guard de ruta y pantallas login/register/logout; retiro de la API key de `localStorage`.
- Transición dual: aceptar sesión válida **o** `X-API-Key` (mapeada al owner bootstrap), con advertencia de deprecación y flag de deshabilitación.

### Out of Scope
- Google OAuth, password reset, verificación de email funcional, admin UI, onboarding `USER → OWNER`, rate limiting distribuido, refresh/rotation de tokens.

## Capabilities

### New Capabilities
None — no se introduce una capability nueva; `user-auth` ya existe pero obsoleta.

### Modified Capabilities
- `user-auth`: reemplaza Auth.js/Google/JWT/`proxy.ts` por email/password + sesiones server-side + roles (`USER`, `OWNER`, `ADMIN`) y endpoints `/auth/*`.
- `owner-portal`: el requisito "Owner authentication via API key stub" pasa a sesión + rol OWNER (delta con transición dual).
- `go-api`: el contrato de error `401` (API key) se extiende a sesión inválida/rol insuficiente.

## Approach

Migración amplía `users` y crea `sessions`. El login genera un token aleatorio (SHA-256 en DB), lo fija en cookie `HttpOnly`, `Secure`, `SameSite=Lax` y agrega CSRF (token de doble envío) para mutaciones. Middleware resuelve actor por sesión; el middleware de rol exige `OWNER` en rutas owner y verifica `owner_id` del store contra el actor. Transición dual: si no hay cookie válida, fallback a `X-API-Key` con warning de deprecación.

## Key Decisions

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Sesión | Server-side + cookie httpOnly | Revocación inmediata, logout real, sin tokens expuestos a JS; encaja con SPA same-origin detrás de nginx |
| Hashing | **Argon2id** (`golang.org/x/crypto/argon2`) | Memory-hard, resistente a GPU/ASIC; recomendado por OWASP sobre bcrypt |
| Roles | `USER`/`OWNER`/`ADMIN` en `users.role` | Mínimo suficiente; `ADMIN` solo por migración/operación, nunca por input público |
| Bootstrap OWNER | `OWNER_BOOTSTRAP_EMAIL` | Evita escalada de privilegios por auto-promoción al crear tienda |
| Transición | Dual `X-API-Key` + sesión, flag de apagado | No rompe dashboard/despliegue existente; rollback = reactivar stub |
| Booking anónimo | Se mantiene `PENDING` | No se altera el contrato público; autenticado queda `PENDING` salvo decisión explícita aparte |

## Affected Areas

| Area | Impact | Descripción |
|------|--------|-------------|
| `backend/migrations/` | New | Ampliar `users`, crear `sessions` (no destructivo) |
| `backend/internal/config/config.go` | Modified | Cookie secrets, `OWNER_BOOTSTRAP_EMAIL`, `AUTH_DISABLE_API_KEY` |
| `backend/internal/store/` | Modified | Queries parametrizadas: users, sessions, stores-by-owner |
| `backend/internal/service/` | Modified | Register/Login/Logout/Me, hashing Argon2id, validación de sesión |
| `backend/internal/http/` | Modified | Middleware de sesión/rol/CSRF; handlers `/auth/*`; autorización por `owner_id` |
| `frontend/src/api/` | Modified | `credentials: "include"`, manejo `401`, retiro gradual de `apiKey` |
| `frontend/src/pages/` + `App.tsx` | Modified | Login/register/logout, guard de ruta, quitar pantalla de API key |
| Tests (Go + Vitest) | Modified | Coexistencia `X-API-Key` y sesión durante transición |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cookie sin CSRF en mutaciones | High | Token CSRF de doble envío en POST/PATCH/DELETE |
| `Secure`/CORS mal detrás de Dokploy | Med | Verificar proxy, no mezclar credenciales con `Allow-Origin: *` |
| IDOR: cambiar solo middleware sin ownership por `owner_id` | Med | Verificación de ownership en cada handler con `storeID` |
| `localStorage` con API key durante transición | Med | Retirar del frontend primero; flag `AUTH_DISABLE_API_KEY` |
| Test que asumen `X-API-Key` | Med | Fase dual con pruebas de cookie+sesión antes de quitar el stub |
| Sesiones huérfanas en DB | Low | Limpieza periódica de sesiones expiradas |

## Rollback Plan

Reactivar el stub sin romper compatibilidad: las migraciones son aditivas y no destructivas; se conserva `X-API-Key` funcional durante la transición. Si falla, basta desactivar el middleware de sesión y volver a `RequireAPIKey`, sin revertir migraciones (las tablas nuevas quedan inertes). Frontend: reintroducir `X-API-Key` vía config/build sin secretos en el bundle.

## Dependencies

- `golang.org/x/crypto` (Argon2id) — agregar al `go.mod`.
- PostgreSQL compartido disponible para sesiones (rate limiter sigue in-memory).

## Success Criteria

- [ ] Usuario registra, inicia sesión y accede a `/dashboard` con rol `OWNER`; sin sesión → redirigido.
- [ ] Endpoints owner rechazan un `storeID` ajeno al actor (401/403), no solo por ruta.
- [ ] `make test` y Vitest pasan con pruebas de cookie/sesión y `X-API-Key` en transición.
- [ ] `localStorage.dashboard.apiKey` eliminado del código frontend.
- [ ] Login con credenciales inválidas → 401; booking anónimo sigue `PENDING`.