# Proposal: migracion-react-go

## Intent

El monolito Next.js 16 fullstack (App Router + Prisma 7 + Auth.js v5) mezcla lógica de negocio, HTTP, render y persistencia en un solo runtime, lo que impide escalar el backend independientemente, bloquea el despliegue en Dokploy (2 apps + Postgres compartido) y obliga a cargar el framework entero para servir JSON. Este cambio **reescribe** la app sobre un frontend SPA (Vite + React 19) y un backend Go (REST), manteniendo el contrato funcional del openspec para el core: landing, stores (listado/detalle/búsqueda), reserva de turnos (slots) y dashboard del dueño (horarios, blocked dates, agenda del día, estados, PENDING queue).

## Scope

### In Scope
- Frontend SPA: Vite + React 19 + react-router, portando componentes client (`StoreCard`, `SearchBar`, `Pagination`, `DayCalendar`, `PendingQueue`, `TodayAgenda`, `AppointmentDetail`, `ui/*`) y `globals.css`. Docker build → nginx estático con `proxy /api → backend`.
- Backend Go: `chi` + `pgx` + `goose`. Módulo único `backend/` con `cmd/api`, `internal/{http,service,store,config}`, `migrations/`. Sin `go.work`.
- API REST core: público (stores + slots + book), owner (CRUD stores, business hours, blocked dates, appointments, estados, reschedule).
- Concurrencia de reservas: transacción con `SELECT ... FOR UPDATE` sobre la fila del store (serializa por store; descarta advisory locks por complejidad innecesaria).
- DB nueva: goose migrations fresh desde schema.prisma como fuente de verdad. IDs UUID v4 generados en Go.
- Auth dashboard stub: API key estática vía `X-API-Key` (reemplazable por Google OAuth sin cambiar contrato del front).
- Contrato fecha/hora: SPA envía `{date: "YYYY-MM-DD", time: "HH:MM"}`; Go interpreta con `time.LoadLocation(store.timezone)` y `AddDate` (DST-safe). Servidor = única fuente de verdad de tz.
- Rutas canónicas: `slug` para público, `id` para owner.
- Despliegue Dokploy: 2 aplicaciones + PostgreSQL compartido. `docker-compose.yml` para dev local.

### Out of Scope
- Auth real (Google OAuth), admin, analytics, Google Calendar sync, emails/cron, WhatsApp, reviews/favorites, notificaciones.
- Migración de datos: se parte de DB vacía.
- Portar modelos `Review`, `CalendarSync`, `Account`, `Session`, `VerificationToken`, `favorites`.

## Capabilities

### New Capabilities
- `go-api`: superficie REST completa (chi), middleware CORS/rate-limit, contrato JSON, paginación, manejo de errores estandarizado.
- `react-spa`: frontend Vite+React, sistema de rutas, capas `api/` (fetch), componentes portados, build nginx.

### Modified Capabilities
- `public-landing`: reimplementada sobre SPA; se agrega filtro `q` (ILIKE sobre name/specialty/address).
- `store-booking`: reimplementada; reglas de slots se reescriben en Go con `time.LoadLocation`; concurrencia con `FOR UPDATE`.
- `owner-portal`: reimplementada; autenticación reemplazada por API key stub.
- `owner-appointments`: reimplementada; mismos estados y transiciones.
- `project-foundation`: reemplaza stack (Next.js+Prisma → Go+pgx+Vite).

No modifican su contrato funcional. Las siguientes quedan intactas y fuera de alcance: `user-auth`, `customer-profile`, `notifications`.

## Approach

1. **Migrations fresh**: goose migrations que replican schema.prisma (users, stores, business_hours, blocked_dates, appointments) con UUIDs y sin modelos excluidos. `cancelationLimit` y `management_token` se mantienen en schema por compatibilidad; se documenta que no se aplican en esta fase.
2. **Go API**: handlers chi → services → pgx store. `GET /stores/public?q=` con ILIKE. Ratings: `averageRating=0`, `reviewCount=0` (reviews fuera de alcance).
3. **Slots**: contar turnos donde `status NOT IN ('CANCELLED')` (COMPLETED ocupa capacidad — regla documentada).
4. **Reserva atómica**: BEGIN → `SELECT ... FROM stores WHERE id = $1 FOR UPDATE` → validar slot → `INSERT INTO appointments` → COMMIT. Rollback con 409 si no hay slot.
5. **Frontend**: componentes client portados tal cual; RSC de landing → `useEffect` + fetch. Estado global mínimo (React context).
6. **Deployment**: Dockerfile frontend (node → nginx), Dockerfile backend (go build → distroless), docker-compose con postgres, volumes y red interna.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/` (Next.js) | Removed | Se elimina tras migración verificada |
| `prisma/schema.prisma` | Reference only | Fuente de verdad para goose migrations; no se usa en runtime |
| `frontend/` | New | Vite + React 19 SPA |
| `backend/` | New | Go chi API |
| `docker-compose.yml` | New | Dev local (postgres + frontend + backend) |
| `openspec.md`, `openspec/sdd/tasks.md` | Kept | Documentación de producto preservada |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition en reservas bajo carga | Medium | `FOR UPDATE` por store serializa; test de concurrencia obligatorio |
| Drift fecha/hora por DST | Medium | `time.LoadLocation` + `AddDate` (no suma horas fijas); tests con fechas DST |
| Pérdida de SEO al pasar a SPA | Low | Landing pública con meta tags en `index.html`; sitemap estático |
| API key stub filtrada | Low | Variable de entorno; docs advierten que es temporal; reemplazo futuro por OAuth |
| Portar estilos/componentes client pierde fidelity | Low | Se porta `globals.css` tal cual; review visual antes de merge |

## Rollback Plan

El cambio es no-destructivo hasta el corte final:
1. Las carpetas `frontend/` y `backend/` conviven con `src/` durante toda la fase de apply.
2. El `git revert` del commit de corte elimina `frontend/`+`backend/` y restaura `src/`+`prisma/` intactos (están versionados en paralelo).
3. La DB nueva es independiente; la DB original de Prisma no se toca. Rollback = `git revert` + apuntar `DATABASE_URL` a la DB antigua.
4. Dokploy: no se toca el deploy existente hasta que la verificación pase; el nuevo deploy corre en paralelo con otro subdominio.

## Dependencies

- Dokploy operativo con PostgreSQL compartido accesible.
- Variable `DASHBOARD_API_KEY` definida en entorno.
- Dominio/subdominio para frontend estático y backend API.

## Success Criteria

- [ ] Todos los endpoints core responden en <200ms p95 (local).
- [ ] Reserva atómica pasa test de concurrencia (10 goroutines, 1 slot → 1 ganador, resto 409).
- [ ] Slots calculados coinciden 1:1 con la implementación Next.js actual para 30 días de fixture.
- [ ] Frontend SPA renderiza todos los componentes portados sin cambios visuales detectables.
- [ ] docker-compose levanta stack completo con un solo `docker compose up`.
- [ ] Dokploy despliega 2 apps + Postgres compartido con healthchecks verdes.
- [ ] `goose up` corre contra DB vacía sin errores y produce schema equivalente a `prisma db push`.
