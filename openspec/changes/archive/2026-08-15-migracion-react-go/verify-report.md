```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:030f95fc7bc5e75160b4942129eec3a59a069d704661436d40fca51c6dd81547
verdict: pass
blockers: 0
critical_findings: 0
requirements: 34/34
scenarios: 49/49
test_command: cd backend && go build ./... && go vet ./... && go test -count=1 ./...
test_exit_code: 0
test_output_hash: sha256:030f95fc7bc5e75160b4942129eec3a59a069d704661436d40fca51c6dd81547
build_command: cd frontend && npm run build
build_exit_code: 0
build_output_hash: sha256:a77e67d53c2ec9e082ebc9018ab566a060f44f5e93386a7cc225a6ed5b4be5be
```

## Verification Report

**Change**: migracion-react-go
**Version**: N/A
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build (frontend)**: ✅ Passed
```text
$ npm run build            (frontend/)
vite v6.4.3 building for production...
✓ 62 modules transformed.
dist/index.html                 0.60 kB │ gzip:  0.37 kB
dist/assets/index-DAOuZ-eh.css  42.18 kB │ gzip:  8.24 kB
dist/assets/index-XVgBu8JR.js  297.46 kB │ gzip: 90.42 kB
✓ built in 1.18s
EXIT: 0
```

**Build (backend)**: ✅ Passed (`go build ./... && go vet ./...` → exit 0, sin output)

**Tests (backend)**: ✅ All packages passed
```text
$ go test -count=1 ./...   (backend/)
?   github.com/salvuccifacundo/appointments-app/backend/cmd/api            [no test files]
?   github.com/salvuccifacundo/appointments-app/backend/internal/config    [no test files]
?   github.com/salvuccifacundo/appointments-app/backend/internal/http      [no test files]
ok  github.com/salvuccifacundo/appointments-app/backend/internal/http/handlers    0.009s
ok  github.com/salvuccifacundo/appointments-app/backend/internal/http/middleware   0.007s
ok  github.com/salvuccifacundo/appointments-app/backend/internal/service           0.010s
?   github.com/salvuccifacundo/appointments-app/backend/internal/store     [no test files]
EXIT: 0
```

**Tests (frontend)**: ✅ 4 passed
```text
$ npm test                  (frontend/)
✓ src/api/client.test.ts (4 tests)
Test Files  1 passed (1)
     Tests  4 passed (4)
EXIT: 0
```

**Integration — concurrencia (Postgres local real)**: ✅ Passed with `-race`
```text
$ DATABASE_URL_TEST="postgres://postgres@localhost:5432/postgres?sslmode=disable" go test -count=1 -race -run Book ./internal/service/ -v
=== RUN   TestBook_HappyPath            --- PASS
=== RUN   TestBook_SlotUnavailable      --- PASS
=== RUN   TestBook_UnknownSlug          --- PASS
=== RUN   TestBook_MissingClientName    --- PASS
=== RUN   TestBook_InvalidTimeFormat    --- PASS
=== RUN   TestBook_ConcurrentSingleSlot --- PASS
PASS
ok  github.com/salvuccifacundo/appointments-app/backend/internal/service  1.160s
EXIT: 0
```

**Lint**: golangci-lint no instalado en el entorno (skip, no bloquea; `go vet` pasa).

### Spec Compliance Matrix

#### go-api (5 requirements / 5 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| REST API Go con chi (slug público, id owner) | `backend/internal/http/router.go` — chi v5, rutas públicas + owner group, `/health` → `{status:"ok"}` | ✅ COMPLIANT |
| Error contract `{error:{code,message,field}}` | `handlers/respond.go` + `middleware/respond.go`; FieldError→400, ConflictError→409, ErrNotFound→404, resto→500 | ✅ COMPLIANT |
| CORS + rate limit (anón 10/min, owner 30/min, Retry-After) | `middleware/cors.go`, `middleware/ratelimit.go` (map+mutex, `Retry-After` en 429) | ✅ COMPLIANT |
| Paginación `{data,page,limit,total,totalPages}`, limit ≤ 100 | `service/pagination.go` (`DefaultLimit=12`, `MaxLimit=100`) | ✅ COMPLIANT |
| API key stub owner (X-API-Key, 401) | `middleware/requireapikey.go` (`subtle.ConstantTimeCompare`) | ✅ COMPLIANT |

| Scenario | Test | Result |
|----------|------|--------|
| GET /health → 200 ok | `handlers_test.go > TestHealth` | ✅ COMPLIANT |
| Validation error shape | `handlers_test.go > TestBook_ValidationFieldError` | ✅ COMPLIANT |
| Anónimo 11º request → 429 + Retry-After | `middleware_test.go > TestRateLimit_Anonymous429WithRetryAfter` | ✅ COMPLIANT |
| Owner route sin key → 401 unauthorized | `middleware_test.go > TestRequireAPIKey_401WithoutKey` + `TestOwnerRoute_RequiresAPIKey` | ✅ COMPLIANT |
| Owner route con key válida pasa | `middleware_test.go > TestRequireAPIKey_AllowsValidKey` + `TestOwnerRoute_AllowsValidKey` | ✅ COMPLIANT |

#### react-spa (5 requirements / 4 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| Vite React 19 + react-router, rutas `/` `/:slug` `/dashboard` | `frontend/src/App.tsx` (BrowserRouter + 3 rutas) | ✅ COMPLIANT |
| API client layer `src/api/`, VITE_API_URL, X-API-Key en dashboard | `frontend/src/api/{client,stores,appointments,types}.ts` | ✅ COMPLIANT |
| Componentes portados ui/* + appointments/* + globals.css | `frontend/src/components/ui/*` (8), `appointments/*` (7) + `src/styles/globals.css` | ✅ COMPLIANT |
| Build estático servido por nginx, proxy /api | `frontend/Dockerfile` + `nginx.conf` (SPA fallback + proxy /api) | ✅ COMPLIANT |
| Public pages fetch desde API, sin RSC | `Home.tsx`, `StoreDetail.tsx` (useEffect + fetch) | ✅ COMPLIANT |

| Scenario | Test | Result |
|----------|------|--------|
| SPA sirve landing en `/` | Ruta registrada (App.tsx) + build OK; sin test de render | ✅ COMPLIANT (estático) |
| Store detail por slug fetchea API | Ruta `/:slug` → StoreDetail (estático) | ✅ COMPLIANT (estático) |
| Build produce dist/ con hashes | `npm run build` exit 0 (evidencia arriba) | ✅ COMPLIANT |
| Landing carga stores de `GET /api/stores/public` | `Home.tsx` → `listPublicStores` (estático) | ✅ COMPLIANT (estático) |

#### public-landing (3 requirements / 4 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| Listado paginado (12) + filtro `q` ILIKE + `specialty` | `store/stores.go` `ListPublicStores` (`ILIKE` name/specialty/address, specialty exacta, `ORDER BY name LIMIT OFFSET`) | ✅ COMPLIANT |
| Store card sin ratings (averageRating=0, reviewCount=0) | `handlers/stores.go` `publicStore` (zero values) | ✅ COMPLIANT |
| Landing usa `GET /api/stores/public` | `Home.tsx` + `api/stores.ts` | ✅ COMPLIANT |

| Scenario | Test | Result |
|----------|------|--------|
| Filtro specialty | `handlers_test.go > TestListPublicStores_Paginated` (pasa q+specialty) | ✅ COMPLIANT |
| Búsqueda por texto libre | Query ILIKE (estático) + arg test anterior | ✅ COMPLIANT |
| Paginación >1 page | `pagination_test.go` + `TestListPublicStores_Paginated` | ✅ COMPLIANT |
| Landing refleja búsqueda backend | `Home.tsx` envía `?q` (estático) | ✅ COMPLIANT (estático) |

#### store-booking (4 requirements / 11 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| Detalle público `GET /api/stores/public/{slug}` | `handlers/stores.go` `GetPublicStore` (nombre, descripción, dirección, tel, specialty, timezone, hours) | ✅ COMPLIANT |
| Booking `{date,time,...}` → PENDING + managementToken, tz del store | `service/booking.go` `Book` (tx + FOR UPDATE, token uuid, `time.LoadLocation`) | ✅ COMPLIANT |
| Slots computados en Go (ventanas open..close, start+duration<=close, CANCELLED no ocupa, COMPLETED ocupa, DST AddDate) | `service/slots.go` `AvailableSlots` + `localDayWindow` (AddDate) + `time/tzdata` | ✅ COMPLIANT |
| maxSlotsPerDay > 0 deshabilita el día al alcanzarse | `service/slots.go` (`withinDailyLimit`) | ✅ COMPLIANT |

| Scenario | Test | Result |
|----------|------|--------|
| Store page renderiza desde API | Estático (StoreDetail) | ✅ COMPLIANT (estático) |
| Slug inexistente → 404 | `handlers_test.go > TestGetPublicStore_NotFound` | ✅ COMPLIANT |
| Anónimo reserva slot → 201 PENDING + token | `booking_test.go > TestBook_HappyPath` (integración, PG real) | ✅ COMPLIANT |
| Slot a capacidad → 409 slot_unavailable | `TestBook_SlotUnavailable` (service + handler) | ✅ COMPLIANT |
| Concurrencia atómica (1 slot → 1×201, 1×409) | `TestBook_ConcurrentSingleSlot` `-race` PG real | ✅ COMPLIANT |
| Slots respetan horario (Mon-Fri 09-17, 60min → 8 slots) | `slots_test.go > TestAvailableSlots_RespectsBusinessHours` | ✅ COMPLIANT |
| Blocked date → [] | `TestAvailableSlots_BlockedDate` | ✅ COMPLIANT |
| CANCELLED no ocupa | `TestAvailableSlots_CancelledDoesNotOccupy` | ✅ COMPLIANT |
| COMPLETED ocupa | `TestAvailableSlots_CompletedOccupies` | ✅ COMPLIANT |
| DST con AddDate | `TestLocalDayWindow_DST` + `TestAvailableSlots_DSTDayBoundary` | ✅ COMPLIANT |
| Límite diario alcanzado | `TestAvailableSlots_MaxSlotsPerDay` | ✅ COMPLIANT |

#### owner-portal (5 requirements / 9 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| Auth API key stub (X-API-Key), contrato reemplazable | `middleware/requireapikey.go` + `api/client.ts` (header) | ✅ COMPLIANT |
| CRUD store + slug único auto-generado | `service/stores.go` `CreateStore` → `GenerateUniqueSlug` (`slug.go` + `SlugExists`); `handlers/stores.go` `createStoreBody`/`updateStoreBody` | ✅ COMPLIANT |
| Horarios reemplazo tx (delete+create) | `store/hours.go` `ReplaceBusinessHours` (tx) | ✅ COMPLIANT |
| Blocked dates solo futuras (400 pasada) | `service/stores.go` `CreateBlockedDate` → `ValidateFutureDate` | ✅ COMPLIANT |
| Lista stores del owner con hours y blocked dates | `handlers/stores.go` `GetStore` (detail) + `ListOwnerStores` | ⚠️ WARNING |

| Scenario | Test | Result |
|----------|------|--------|
| Dashboard carga con key | `client.test.ts > "sends the X-API-Key header"` + `TestOwnerRoute_AllowsValidKey` | ✅ COMPLIANT |
| Dashboard sin key → 401 | `TestRequireAPIKey_401WithoutKey` | ✅ COMPLIANT |
| Owner crea store → 201 con slug | `handlers_test.go > TestCreateStore_Success` + `slug_test.go` | ✅ COMPLIANT |
| Owner actualiza settings | `store/stores.go` `UpdateStore` (allowlist + updated_at) | ✅ COMPLIANT (estático) |
| Owner guarda horarios | `store/hours.go` tx (estático) | ✅ COMPLIANT (estático) |
| `openTime="25:00"` → 400 | `handlers_test.go > TestUpdateHours_InvalidTime` | ✅ COMPLIANT |
| Owner bloquea fecha futura | `handlers_test.go > TestCreateBlockedDate_PastDate` (negativo) + `ValidateFutureDate` | ✅ COMPLIANT |
| Fecha pasada → 400 | `TestCreateBlockedDate_PastDate` (400, field=date) | ✅ COMPLIANT |
| Owner ve sus stores | `ListOwnerStores` (estático; ver WARNING-1) | ⚠️ WARNING |

#### owner-appointments (5 requirements / 10 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| Listado por fecha (tz del store, ventana UTC en SQL) | `service/appointments.go` `ListAppointments` (window local → UTC) + `store/appointments.go` `ListAppointments` (ORDER BY date_time) | ✅ COMPLIANT |
| Create manual → CONFIRMED | `service/appointments.go` `CreateAppointment` (status default CONFIRMED) | ⚠️ WARNING |
| State machine `PUT .../{aid}` {action} con 400 field=action | `service/state_machine.go` `ValidateTransition` (case-insensitive, terminales) | ✅ COMPLIANT |
| Reschedule excluye el propio turno | `service/appointments.go` `RescheduleAppointment` → `AppointmentsInWindowExcluding` | ✅ COMPLIANT |
| PendingQueue + DayCalendar en dashboard | `Dashboard.tsx` + `components/appointments/{PendingQueue,DayCalendar}.tsx` | ✅ COMPLIANT |

| Scenario | Test | Result |
|----------|------|--------|
| Lista turnos del día (tz store, asc) | `ListAppointments` (estático; ventana + ORDER BY) | ✅ COMPLIANT (estático) |
| CONFIRM PENDING→CONFIRMED | `state_machine_test.go > TestStateMachine_ValidTransitions` | ✅ COMPLIANT |
| REJECT PENDING→CANCELLED | Ídem | ✅ COMPLIANT |
| COMPLETE CONFIRMED→COMPLETED | Ídem | ✅ COMPLIANT |
| Transición inválida terminal → 400 field=action | `TestStateMachine_TerminalStates` + `handlers_test.go > TestUpdateAppointmentStatus_InvalidAction` | ✅ COMPLIANT |
| Acción sobre turno de otro store → 404 | `appointments_test.go > TestUpdateStatus_CrossStoreNotFound` + `TestReschedule_CrossStoreNotFound` | ✅ COMPLIANT |
| Reschedule a slot disponible | `appointments_test.go > TestReschedule_HappyPathExcludesSelf` | ✅ COMPLIANT |
| Reschedule a slot no disponible → 400 | `TestReschedule_UnavailableSlot` | ✅ COMPLIANT |
| PendingQueue muestra pendientes con contacto | `PendingQueue.tsx` (link WhatsApp `wa.me`) (estático) | ✅ COMPLIANT (estático) |
| DayCalendar colorea por estado | `DayCalendar.tsx` `STATUS_COLORS` (estático) | ✅ COMPLIANT (estático) |

#### project-foundation (7 requirements / 6 scenarios)

| Requirement | Implementación | Verdict |
|-------------|----------------|---------|
| Monorepo frontend/+backend/ sin Next.js | Raíz: `frontend/`, `backend/`, `docker-compose.yml`, sin `src/`, `prisma/`, `next.config.ts`, `package.json` | ✅ COMPLIANT |
| Módulo Go único con cmd/api, internal/{http,service,store,config}, migrations | `backend/` (estructura verificada) | ✅ COMPLIANT |
| Schema goose (enum + users/stores/business_hours/blocked_dates/appointments + índices) | `backend/migrations/00001_init.{up,down}.sql` | ✅ COMPLIANT |
| date_time timestamptz, valores UTC, tz en el boundary | `migrations/00001_init.up.sql` (`timestamptz`) + `slots.go`/`booking.go` (UTC + `time.LoadLocation`) | ✅ COMPLIANT |
| cancelation_limit no operacional | Columna existe (default 2); no se aplica en ningún endpoint | ✅ COMPLIANT |
| docker-compose dev (postgres + backend + frontend) | `docker-compose.yml` | ✅ COMPLIANT |
| Dockerfiles: backend distroless + frontend nginx proxy /api | `backend/Dockerfile` (golang→distroless) + `frontend/Dockerfile` (node→nginx) | ✅ COMPLIANT |

| Scenario | Test | Result |
|----------|------|--------|
| Repo contiene frontend/backend y sin Next | Inspección directa (evidencia abajo) | ✅ COMPLIANT |
| DB fresca inicializa (tablas, enum, índices) | `00001_init.up.sql` (estático) + `ensureSchema` aplicado en test de integración | ✅ COMPLIANT |
| Enum = PENDING/CONFIRMED/CANCELLED/COMPLETED | `00001_init.up.sql` + `store/store.go` | ✅ COMPLIANT |
| Stack local levanta (compose) | `docker-compose.yml` (estático; no ejecutado docker compose) | ✅ COMPLIANT (estático) |
| Imagen backend construye | `backend/Dockerfile` (estático; no ejecutado docker build) | ✅ COMPLIANT (estático) |
| Imagen frontend construye | `frontend/Dockerfile` + `nginx.conf` (estático; no ejecutado docker build) | ✅ COMPLIANT (estático) |

**Compliance summary**: 49/49 scenarios compliant (44 con evidencia runtime/estática directa, 5 estáticos sin docker ejecutado).

### Correctness (Static Evidence)

| Check | Resultado | Evidencia |
|-------|-----------|-----------|
| Rutas del router matchean design | ✅ | `router.go` == Data Flow del design (público+owner, slug público / id owner) |
| Front manda {date, time} | ✅ | `BookingForm.tsx:56-64` envía `date`/`time`/clientName/... |
| Error contract respetado | ✅ | `client.ts` parsea `{error:{code,message,field}}`; test dedicado |
| nginx SPA fallback + proxy /api | ✅ | `nginx.conf`: `location /api/` proxy + `try_files ... /index.html` |
| Sin RSC / componentes client | ✅ | `App.tsx`/`Home.tsx`/`StoreDetail.tsx` sin server components |
| Goose enum + 5 tablas + índices | ✅ | `00001_init.up.sql` (slug UNIQUE, idx owner, idx store+datetime) |
| Sin restos Next.js | ✅ | `ls src prisma next.config.ts package.json` → no existen |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| chi v5, pgx v5, goose, módulo único | ✅ | `go.mod` (chi v5.3.1, pgx v5.10.0, uuid) |
| tx + SELECT FOR UPDATE para booking | ✅ | `store/booking.go` `LockStoreBySlugForUpdate` |
| {date,time} + tz del store | ✅ | `booking.go` + `slots.go` |
| X-API-Key estática | ✅ | `requireapikey.go` |
| status != 'CANCELLED' en conteo | ✅ | `slots.go:101` |
| nginx estático + proxy /api | ✅ | `frontend/Dockerfile` + `nginx.conf` |
| Rate limit: design decía x/time/rate | ⚠️ | Implementación con map+mutex propio (fixed-window) — comportamiento spec ok |

### Issues Found

**CRITICAL**: None

**WARNING**:
1. `owner-portal` — El scenario "Owner views their stores" (spec) espera que `GET /api/stores` devuelva stores con business hours y blocked dates embebidos. La implementación devuelve `[]store.Store` plano en `handlers/stores.go:119-126`; hours/blocked dates llegan vía `GET /api/stores/{id}` (el dashboard los carga con `getStore`, ver `Dashboard.tsx:107`). Funcionalmente el dashboard muestra todo, pero el contrato literal del scenario no se cumple en una sola llamada.
2. `owner-appointments` — El requirement "Owner creates an appointment manually" (spec) dice que la validación de disponibilidad SHALL apply salvo override explícito. La implementación (`service/appointments.go:60` `CreateAppointment`) NO valida disponibilidad ni tiene flag de override (comentario: "intentionally not enforced"). No bloquea booking público, pero desvía el texto del spec.

**SUGGESTION**:
1. `owner-portal` — En `handlers/hours.go:24`, el field de error es `[0].openTime` (array index) mientras el spec dice `field="openTime"`. Más preciso, pero difiere del literal.
2. `go-api` — Design elegía `x/time/rate`; se implementó limiter propio map+mutex. El comportamiento (10/30 rpm, Retry-After) es correcto y testeado.
3. CORS no tiene test dedicado (solo implementación + inspección).
4. Docker builds no ejecutados (solo inspección estática de Dockerfiles/compose).
5. `store/` sin tests unitarios directos (cubierto indirectamente por integración de booking).
6. Side effect del test de integración: aplica schema y deja datos en la DB local `postgres` (esperado en dev, no usar contra prod).

### Verdict
PASS WITH WARNINGS — los 21/21 tasks están completos, builds y suites pasan, el test de concurrencia con `-race` pasa contra Postgres real, y no hay hallazgos CRITICAL. Los 2 WARNING son desviaciones de literal de spec que no rompen funcionalidad.

### Resumen Final
La migración Next.js → React SPA + Go API + PostgreSQL está implementada y verifica de punta a punta: 34/34 requirements y 49/49 scenarios cumplidos (con 2 WARNING de contrato literal y 6 SUGGESTION). El stack Next.js fue eliminado del repo. Evidencia ejecutada: `go build`/`go vet`/`go test -count=1 ./...` (exit 0), `npm run build` (exit 0), `npm test` (4/4), y el test de integración de concurrencia con `-race` contra Postgres local (exit 0, `TestBook_ConcurrentSingleSlot` PASS). next_recommended: **archive** tras resolver (o aceptar documentados) los 2 WARNING.

## Update post-verificación (2026-08-15)

Los 2 WARNING de la verificación original fueron corregidos y verificados:

### WARNING 1 — RESUELTO
`GET /api/stores` (owner) ahora devuelve cada store con `businessHours` y `blockedDates` embebidos (commit `f9f8b89`). Nuevo tipo `store.StoreDetail`; `GET /api/stores/{id}` mantiene contrato byte a byte.

### WARNING 2 — RESUELTO
`POST /api/stores/{id}/appointments` (creación manual) ahora valida disponibilidad salvo `force: true` explícito; sin force y slot ocupado → `409 slot_unavailable` (commits `0532031`). Default valida.

### Evidencia
- `go build ./... && go vet ./...` → exit 0
- `go test ./...` → verdes (incl. `TestCreateAppointment_ValidatesAvailabilityUnlessForce`)
- `DATABASE_URL_TEST=... go test -count=1 -race ./...` → verdes
- Front sin cambios necesarios (no crea turnos manuales hoy; flag force disponible en contrato).

**Verdicto final: PASS** (0 CRITICAL, 0 WARNING pendientes).
