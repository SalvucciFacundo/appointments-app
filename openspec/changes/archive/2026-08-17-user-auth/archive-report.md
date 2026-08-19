# Archive Report — user-auth (Autenticación de usuarios)

**Fecha de archivo**: 2026-08-17
**Change**: user-auth
**Verdict final**: PASS WITH WARNINGS
**Rama base de verificación**: `feat/user-auth-03-frontend` (cadena `feat/user-auth-01-backend-core` → `feat/user-auth-02-backend-http` → `feat/user-auth-03-frontend`, estrategia **stacked-to-main**)

## Estado final del ciclo

El ciclo SDD de `user-auth` está **completo**: planificado, implementado, verificado y archivado. Todos los artefactos del change se conservan íntegros en `openspec/changes/archive/2026-08-17-user-auth/` (proposal, explore, design, specs delta, tasks, verify-report). No se eliminó ni modificó ningún artefacto del change.

## Verificación final (source: `verify-report.md`, 2026-08-17)

| Métrica | Valor |
|---------|-------|
| Verdict | `pass_with_warnings` |
| Tasks totales | 41 |
| Tasks completas | 41 |
| Tasks incompletas | 0 |
| Requirements | 18/18 |
| Scenarios | 32/32 |
| Build backend (`make build`) | exit 0 |
| Build frontend (`tsc && vite build`) | exit 0 (301.40 kB JS, 42.46 kB CSS) |
| Tests backend | 120 tests en 3 paquetes, exit 0 |
| Tests frontend | 11 tests (vitest 3.2.7), exit 0 |
| `make vet` | exit 0 |
| `go mod tidy` | sin cambios |
| Smoke E2E | completo contra DB throwaway (register/login/me/403/dual/CSRF/logout/401, migración no destructiva, CORS, rate limit con Retry-After) |
| Migraciones goose | single-file `00002_user_auth.sql`, up/down verificado E2E, no destructiva |

## Warnings registrados

1. **`golangci-lint` ausente en PATH** — `make lint` no pudo ejecutarse. **Pre-existente** (también bloqueado en la migración React+Go), no introducido por este cambio.
2. **Rate limiter por IP** — `clientID` confía en el primer hop de `X-Forwarded-For` sin validar; comportamiento heredado del helper TypeScript original, fuera del alcance de este cambio.
3. **`EnsureOwnerUser` legacy muerto** — `INSERT ... ON CONFLICT DO NOTHING` sin promoción de rol; el grupo owner exige OWNER y el bootstrap ya crea la fila, por lo que queda como código muerto funcional. Candidato a limpieza futura.

No hay hallazgos CRITICAL. Los warnings no rompen spec ni diseño.

## Sync de specs (delta → main)

| Domain | Acción | Detalle |
|--------|--------|---------|
| user-auth | Reemplazado | Spec obsoleta (Auth.js/Next.js) eliminada: 5 REMOVED (Auth.js Configuration, Role Injection, Route Protection, API Route Handler, Session Provider) aplicados; 13 ADDED pasan a main. |
| owner-portal | Actualizado | 1 MODIFIED ("Owner authentication via API key stub" → sesión server-side + transición dual) + 1 ADDED ("Guard de ruta del dashboard"); 4 requisitos no tocados preservados. |
| go-api | Actualizado | 3 MODIFIED aplicados (JSON error contract 401/403, API key stub transición dual, CORS/rate limiting); 2 requisitos no tocados preservados (REST API chi, Paginated response contract). |

## Ramas de entrega

| Rama | Slice | Estado |
|------|-------|--------|
| `feat/user-auth-01-backend-core` | Migración + store users/sessions + service auth/password + config (dual X-API-Key sigue activo) | Implementado y verificado. PR pendiente, **stacked-to-main**. |
| `feat/user-auth-02-backend-http` | Middleware session/role/csrf/ratelimit + handlers `/auth/*` + ownership por owner_id + wiring | Implementado y verificado. PR pendiente, **stacked-to-main** (target: `feat/user-auth-01-backend-core`). |
| `feat/user-auth-03-frontend` | Cliente credentials/CSRF, AuthProvider, login/register/logout, retiro de localStorage, guard de ruta | Implementado y verificado (rama de la verificación). PR pendiente, **stacked-to-main** (target: `feat/user-auth-02-backend-http`). |

Las 3 ramas existen localmente; **ninguna fue pusheada a `origin`**, por lo que los 3 PRs están pendientes de creación.

## Trazabilidad

- Artefactos leídos desde el filesystem (modo openspec/hybrid): `openspec/changes/user-auth/{proposal.md, design.md, explore.md, tasks.md, verify-report.md}`, `openspec/changes/user-auth/specs/{user-auth,owner-portal,go-api}/spec.md`, `openspec/specs/{user-auth,owner-portal,go-api}/spec.md`, `openspec/config.yaml`.
- No se leyeron observaciones de Engram: los artefactos residen en el repo (modo openspec/hybrid).
- Verificación del archivo: `git mv` + readback `diff -r` vacío (snapshot pre-movimiento vs directorio archivado) — sin truncación ni alteración de bytes.