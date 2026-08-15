# Design: migracion-react-go

## Technical Approach

Reescribir el monolito Next.js 16 (App Router + Prisma + Auth.js) como un monorepo de dos aplicaciones independientes: un backend REST en Go (`backend/`) con chi + pgx + goose, y un frontend SPA en React 19 + Vite (`frontend/`). La lógica de negocio pura del core (slots, state machine, validators, pagination, slug) se porta de `src/lib/*.ts` a servicios Go con tests unitarios sin DB; el acceso a datos se implementa con pgx (queries parametrizadas, tx para booking). El frontend porta los componentes client existentes y consume la API vía una capa `src/api/`, apuntando a `/api` (proxy nginx en prod, vite proxy en dev). El despliegue es 2 aplicaciones Dokploy (frontend nginx + backend Go) más un PostgreSQL compartido; `docker-compose.yml` para dev local.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Stack backend | chi vs echo vs net/http | chi es minimalista, middleware estándar, sin magia; echo es más opinado | chi v5 |
| Acceso a datos | pgx directo vs ORM (sqlc/gorm) | pgx: control total, queries explícitas, sin capa de generación; sqlc agrega tooling | pgx v5 (pgxpool) |
| Migraciones | goose vs golang-migrate | goose: migraciones SQL versionadas, CLI simple, reversible | goose |
| Módulo Go | monorepo de módulos vs módulo único | Un solo servicio → módulo único `backend/`; go.work innecesario | Módulo único |
| Capas | thin: http→service→store vs hexagonal completo | Lógica de negocio no trivial (tz, slots, concurrencia) justifica service puro + store | http (handlers+middleware) → service (lógica pura) → store (pgx) |
| Concurrencia booking | tx + SELECT FOR UPDATE vs advisory lock | FOR UPDATE sobre fila del store serializa reservas por store, simple y testable | tx + FOR UPDATE store |
| Contrato fecha/hora | {date,time} vs ISO offset | {date,time} + tz del store elimina ambigüedad de offsets y bugs de navegador; servidor = fuente de verdad | {date, time} interpretado con `time.LoadLocation` |
| Auth dashboard | API key stub vs sesiones | Stub simple, reemplazable por OAuth sin cambiar contrato front | X-API-Key estática (env `API_KEY`) |
| Conteo de slots | filtrar CANCELLED vs contar todo | CANCELLED no ocupa capacidad (correcto); COMPLETED sí (mantiene histórico del día) | status != 'CANCELLED' en conteo |
| ID | UUID v4 vs cuid | DB nueva → UUID v4 generado en Go (pgx + google/uuid) | UUID v4 |
| Frontend build | nginx estático vs node serve | Estático + proxy /api es lo más liviano en Dokploy | nginx estático con proxy /api → backend |
| Rate limit | mutex + ventana deslizante vs x/time/rate | x/time/rate por cliente con map + mutex; simple y suficiente para single instance | map + mutex + x/time/rate |

## Data Flow

```
Browser (SPA)
   │
   ├── Public: /, /:slug
   │     └── fetch GET /api/stores/public?q=&specialty=&page=&limit=
   │             GET /api/stores/public/{slug}
   │             GET /api/stores/{slug}/slots?date=
   │             POST /api/stores/{slug}/book   {date, time, clientName, ...}
   │
   └── Dashboard: /dashboard  (X-API-Key header)
         ├── GET/POST   /api/stores
         ├── GET/PUT    /api/stores/{id}
         ├── PUT        /api/stores/{id}/hours
         ├── POST/DELETE /api/stores/{id}/blocked-dates[/{bid}]
         ├── GET/POST   /api/stores/{id}/appointments?date=&status=
         ├── PUT        /api/stores/{id}/appointments/{aid}       {action}
         └── PUT        /api/stores/{id}/appointments/{aid}/reschedule {date, time}

Backend (chi)
   ├── middleware: CORS → logging → recover → rate-limit → auth-stub (owner routes)
   ├── handlers: parse/validate → service → JSON response (error contract)
   ├── service: slots.go, state_machine.go, booking.go, stores.go (lógica pura + orquestación)
   └── store (pgx): queries parametrizadas, tx, scaneo por struct
```

```
AvailableSlots(ctx, store, date) — service/slots.go
   ├── blockedDates contiene date → []TimeSlot
   ├── dayOfWeek = date (local, sin tz) .Weekday()
   ├── businessHours[dayOfWeek] no existe → []
   ├── ventana local: loc = time.LoadLocation(store.Timezone)
   │                    inicio = time.Date(y,m,d,0,0,0,0,loc) → UTC
   │                    fin    = inicio.AddDate(0,0,1) → UTC   (DST-safe)
   ├── store.AppointmentsInWindow(ctx, storeID, inicioUTC, finUTC, excluirID?)  → rows
   ├── para cada ventana [open..close) paso slotDuration:
   │     incluir si start+duration <= closeMin
   │     count = appointments cuya hora local ∈ [start, end)
   │     available = count < maxParallel && (maxSlotsPerDay==0 || totalDia < maxSlotsPerDay)
   └── TimeSlot{start, end, available, currentBookings}
```

```
Book(ctx, store, input) — service/booking.go
   ├── BEGIN
   ├── SELECT ... FOR UPDATE FROM stores WHERE id = $1        (serializa por store)
   ├── re-verificar blocked/horario/capacidad (misma lógica de slots, excluyendo nada)
   ├── INSERT INTO appointments (status PENDING + management_token uuid)
   ├── COMMIT
   └── conflict/duplicado → 409 slot_unavailable
```

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/go.mod` | Crear | module `github.com/salvuccifacundo/appointments-app/backend`; chi, pgx, goose, google/uuid, x/time |
| `backend/cmd/api/main.go` | Crear | config → pool → store → service → router → server con graceful shutdown |
| `backend/internal/config/config.go` | Crear | env: `DATABASE_URL`, `PORT`, `API_KEY`, `CORS_ORIGINS`, `APP_URL` |
| `backend/internal/http/router.go` | Crear | rutas chi: públicos (sin auth) + owner (auth-stub) + `/health` |
| `backend/internal/http/middleware/*.go` | Crear | cors, logging, recover, ratelimit, requireapikey |
| `backend/internal/http/handlers/stores.go` | Crear | GET/POST /stores, GET/PUT /stores/{id} |
| `backend/internal/http/handlers/public.go` | Crear | GET /stores/public, GET /stores/public/{slug} |
| `backend/internal/http/handlers/slots.go` | Crear | GET /stores/{slug}/slots |
| `backend/internal/http/handlers/book.go` | Crear | POST /stores/{slug}/book |
| `backend/internal/http/handlers/hours.go` | Crear | PUT /stores/{id}/hours (reemplazo tx) |
| `backend/internal/http/handlers/blocked_dates.go` | Crear | POST/DELETE /stores/{id}/blocked-dates[/{bid}] |
| `backend/internal/http/handlers/appointments.go` | Crear | GET/POST /stores/{id}/appointments, PUT status, PUT reschedule |
| `backend/internal/service/slots.go` | Crear | `AvailableSlots` port de `getAvailableSlots` (lógica pura) |
| `backend/internal/service/state_machine.go` | Crear | enum + transiciones + `ValidateTransition` |
| `backend/internal/service/booking.go` | Crear | `Book` con tx + FOR UPDATE |
| `backend/internal/service/validators.go` | Crear | port de validators.ts (HH:MM, dayOfWeek, future date) |
| `backend/internal/service/slug.go` | Crear | port de slug.ts + unique contra store |
| `backend/internal/service/pagination.go` | Crear | port de pagination.ts |
| `backend/internal/store/store.go` | Crear | pgxpool + structs Store/BusinessHour/BlockedDate/Appointment |
| `backend/internal/store/stores.go` | Crear | queries stores (list público con q ILIKE, bySlug, byId, owner list, create, update) |
| `backend/internal/store/appointments.go` | Crear | window query, create, update status, reschedule, list by date/status |
| `backend/internal/store/hours.go` | Crear | replace horas (tx delete+create), get |
| `backend/internal/store/blocked_dates.go` | Crear | create/delete/list |
| `backend/migrations/00001_init.up.sql` / `.down.sql` | Crear | schema completo (ver sección Migraciones) |
| `backend/Dockerfile` | Crear | multi-stage: golang build → distroless |
| `backend/Makefile` | Crear | run, build, test, migrate-up/down |
| `backend/.golangci.yml` | Crear | lint config |
| `backend/internal/service/slots_test.go` | Crear | unit tests slots (incl. DST) |
| `backend/internal/service/state_machine_test.go` | Crear | unit tests transiciones |
| `backend/internal/service/booking_test.go` | Crear | test concurrencia (10 goroutines, 1 slot) |
| `frontend/package.json`, `vite.config.ts` | Crear | Vite + React 19 + react-router; proxy /api → backend en dev |
| `frontend/index.html` | Crear | shell SPA + meta tags |
| `frontend/src/main.tsx`, `App.tsx`, `router.tsx` | Crear | entry + rutas `/`, `/:slug`, `/dashboard` |
| `frontend/src/api/client.ts` | Crear | fetch wrapper base (baseURL, headers, API key) |
| `frontend/src/api/stores.ts` | Crear | port de lib/stores.ts |
| `frontend/src/api/appointments.ts` | Crear | port de lib/appointments.ts |
| `frontend/src/pages/Home.tsx` | Crear | landing (port de src/app/page.tsx) |
| `frontend/src/pages/StoreDetail.tsx` | Crear | detalle público (port de src/app/[slug]/page.tsx) |
| `frontend/src/pages/Dashboard.tsx` | Crear | dashboard owner (port de src/app/dashboard/page.tsx, sin calendar/analytics) |
| `frontend/src/components/ui/*` | Portar | Button, Input, Card, Toast, Pagination, SearchBar, StoreCard, StarRating (next/link → router) |
| `frontend/src/components/appointments/*` | Portar | DayCalendar, PendingQueue, TodayAgenda, AppointmentDetail |
| `frontend/src/styles/globals.css` | Portar | sistema de diseño de src/app/globals.css |
| `frontend/Dockerfile` | Crear | build → nginx estático con proxy /api |
| `frontend/nginx.conf` | Crear | proxy /api → backend, SPA fallback |
| `frontend/.env.example` | Crear | `VITE_API_URL` |
| `backend/.env.example` | Crear | `DATABASE_URL`, `PORT`, `API_KEY`, `CORS_ORIGINS` |
| `docker-compose.yml` | Crear | dev: postgres + backend + frontend |
| `README.md` | Reescribir | nuevo stack + instrucciones |
| `AGENTS.md`, `.gitignore` | Actualizar | nuevo stack |
| `src/`, `prisma/`, `next.config.ts`, `package.json`, etc. | Eliminar | al final de la migración (se limpia el repo) |

## Interfaces / Contracts

```go
// internal/service/slots.go
type TimeSlot struct {
    Start           string `json:"start"`            // HH:MM
    End             string `json:"end"`              // HH:MM
    Available       bool   `json:"available"`
    CurrentBookings int    `json:"currentBookings"`
}

func AvailableSlots(store Store, date string, existing []Appointment) ([]TimeSlot, error)

// internal/service/state_machine.go
type AppointmentStatus string // PENDING | CONFIRMED | CANCELLED | COMPLETED

func ValidateTransition(current AppointmentStatus, action string) (AppointmentStatus, error)
// acciones: CONFIRM→CONFIRMED, REJECT→CANCELLED, COMPLETE→COMPLETED
// transiciones: PENDING→[CONFIRMED,CANCELLED], CONFIRMED→[COMPLETED,CANCELLED], terminales
// error con field "action"

// internal/service/booking.go
func (s *Service) Book(ctx context.Context, slug string, in BookInput) (*Appointment, error)
type BookInput struct {
    Date        string `json:"date"`          // YYYY-MM-DD
    Time        string `json:"time"`          // HH:MM
    ClientName  string `json:"clientName"`
    ClientPhone string `json:"clientPhone"`
    ClientEmail string `json:"clientEmail"`
    Service     string `json:"service,omitempty"`
    Notes       string `json:"notes,omitempty"`
}

// internal/store/store.go
type Store struct {
    ID                  string  `json:"id"`
    Name                string  `json:"name"`
    Slug                string  `json:"slug"`
    Description         *string `json:"description"`
    Address             string  `json:"address"`
    Phone               *string `json:"phone"`
    Latitude            *float64 `json:"latitude"`
    Longitude           *float64 `json:"longitude"`
    Specialty           string  `json:"specialty"`
    OwnerID             string  `json:"ownerId"`
    Timezone            string  `json:"timezone"`
    SlotDuration        int     `json:"slotDuration"`
    MaxParallelBookings int     `json:"maxParallelBookings"`
    MaxSlotsPerDay      int     `json:"maxSlotsPerDay"`
    CancelationLimit    int     `json:"cancelationLimit"`
    Suspended           bool    `json:"suspended"`
}

type Appointment struct {
    ID             string           `json:"id"`
    StoreID        string           `json:"storeId"`
    ClientName     string           `json:"clientName"`
    ClientPhone    string           `json:"clientPhone"`
    ClientEmail    string           `json:"clientEmail"`
    DateTime       time.Time        `json:"dateTime"`   // RFC3339 UTC
    Service        *string          `json:"service"`
    Status         AppointmentStatus `json:"status"`
    Notes          *string          `json:"notes"`
    ManagementToken *string         `json:"managementToken,omitempty"`
}
```

**Error contract (todos los endpoints)**: `{"error":{"code":"<code>","message":"<msg>","field":"<field?"}}`. Status: 400 validación, 401 sin API key, 404 no encontrado, 409 slot_unavailable, 429 rate limit + `Retry-After`, 500 interno.

**Paginación**: `{"data":[...],"page":n,"limit":n,"total":n,"totalPages":n}`, `limit` default 12, max 100.

## Migraciones

```sql
-- backend/migrations/00001_init.up.sql
CREATE TYPE appointment_status AS ENUM ('PENDING','CONFIRMED','CANCELLED','COMPLETED');

CREATE TABLE users (
    id    text PRIMARY KEY,
    name  text,
    email text UNIQUE,
    image text
);

CREATE TABLE stores (
    id                   text PRIMARY KEY,
    name                 text NOT NULL,
    slug                 text NOT NULL UNIQUE,
    description          text,
    address              text NOT NULL,
    phone                text,
    latitude             double precision,
    longitude            double precision,
    specialty            text NOT NULL,
    owner_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timezone             text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    slot_duration        integer NOT NULL DEFAULT 60,
    max_parallel_bookings integer NOT NULL DEFAULT 1,
    max_slots_per_day    integer NOT NULL DEFAULT 0,
    cancelation_limit    integer NOT NULL DEFAULT 2,
    suspended            boolean NOT NULL DEFAULT false,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_specialty ON stores(specialty);

CREATE TABLE business_hours (
    id         text PRIMARY KEY,
    store_id   text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL,
    open_time  text NOT NULL,   -- HH:MM
    close_time text NOT NULL    -- HH:MM
);
CREATE INDEX idx_business_hours_store ON business_hours(store_id);

CREATE TABLE blocked_dates (
    id       text PRIMARY KEY,
    store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date     date NOT NULL,
    reason   text
);
CREATE INDEX idx_blocked_dates_store ON blocked_dates(store_id);

CREATE TABLE appointments (
    id              text PRIMARY KEY,
    store_id        text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id         text REFERENCES users(id) ON DELETE SET NULL,
    client_name     text NOT NULL,
    client_phone    text NOT NULL,
    client_email    text NOT NULL,
    date_time       timestamptz NOT NULL,
    service         text,
    status          appointment_status NOT NULL DEFAULT 'CONFIRMED',
    notes           text,
    management_token text UNIQUE,
    google_event_id text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_store_datetime ON appointments(store_id, date_time);
CREATE INDEX idx_appointments_user ON appointments(user_id);
```

`00001_init.down.sql`: drop en orden inverso (`appointments`, `blocked_dates`, `business_hours`, `stores`, `users`, `type appointment_status`).

## Testing Strategy

| Capa | Qué | Enfoque |
|------|-----|---------|
| Unit (Go) | `AvailableSlots` | stores con distintos horarios, blocked dates, capacidad, maxSlotsPerDay, casos DST (cambio de hora), CANCELLED no ocupa / COMPLETED ocupa |
| Unit (Go) | `ValidateTransition` | transiciones válidas/inválidas, acciones case-insensitive, terminales |
| Unit (Go) | validators | HH:MM, dayOfWeek, future date |
| Integration (Go) | `Book` concurrencia | 10 goroutines, 1 slot, maxParallel=1 → exactamente 1 éxito (usar tx FOR UPDATE con pgxmock o testcontainer postgres) |
| Integration (Go) | handlers | con httptest + pool real (testcontainer) si el entorno lo permite; mínimo: smoke `/health` |
| Front | vitest | port de los tests existentes de validators/state-machine donde aplique; smoke de rutas |
| Build | Go | `go build ./...`, `go vet`, `golangci-lint` |
| Build | Front | `npm run build` (tsc + vite) |

## Threat Matrix

N/A en esta fase: sin routing shell, subprocess, VCS/PR automation, clasificación de ejecutables, ni integración de procesos del lado del orquestador. El backend expone solo API HTTP; la API key stub se documenta como temporal y reemplazable.

## Migration / Rollout

- **DB**: se parte de DB vacía (goose up en deploy). No hay migración de datos. `schema.prisma` es la referencia de diseño, no se ejecuta Prisma.
- **Despliegue Dokploy**: 1) Postgres compartido (service), 2) aplicación `backend` (Dockerfile multi-stage, env `DATABASE_URL` interno, `API_KEY`, `CORS_ORIGINS`), 3) aplicación `frontend` (Dockerfile nginx, build estático, dominio con TLS, proxy /api → backend).
- **Repositorio**: el trabajo se hace en rama; al finalizar la fase apply se limpia el repo (se elimina el stack Next.js) y se hace push a `SalvucciFacundo/appointments-app`.
- **Rollback**: los contenedores Dokploy conservan versiones previas (redeploy); la DB es nueva, no hay datos que migrar.

## Open Questions

- (Resueltas en la propuesta) Ratios 0/0, cancelationLimit no operacional, management_token generado sin flujo email.
- Decidir en apply si el test de concurrencia usa testcontainers (requiere Docker en CI local) o pgxmock (sin DB real); elegir pgxmock como default y testcontainers opcional.
