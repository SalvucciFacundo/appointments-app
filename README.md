# Appointments App — SaaS Booking Platform

Plataforma multitenant de reservas de turnos para comercios de servicio (peluquerías, veterinarias, estéticas, etc.). Monorepo de dos aplicaciones independientes: un backend REST en Go y un frontend SPA en React, con PostgreSQL compartido.

> Migración: el monolito original Next.js 16 + Prisma + Auth.js fue reemplazado por este stack (ver `openspec/changes/migracion-react-go/`). Todo el stack Next.js fue eliminado del repo.

## Stack

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| **Frontend** | React 19 + Vite + TypeScript + Tailwind CSS v4 + react-router | SPA estática, se sirve con nginx |
| **Backend** | Go 1.26 + chi + pgx | REST API con auth stub por API key |
| **Database** | PostgreSQL 18 + goose | Migraciones SQL versionadas |
| **Auth** | API key estática (`X-API-Key`) | Stub, reemplazable por OAuth sin cambiar el contrato del frontend |

## Estructura del monorepo

```
.
├── backend/               # API Go
│   ├── cmd/api/           # entrypoint
│   ├── internal/
│   │   ├── config/        # env: DATABASE_URL, PORT, API_KEY, CORS_ORIGINS, APP_URL
│   │   ├── store/         # queries pgx parametrizadas (sin SQL interpolado)
│   │   ├── service/       # lógica pura (slots, state machine, validators) + tests
│   │   └── http/          # router chi + middleware (cors, logging, recover, ratelimit, requireapikey)
│   ├── migrations/        # goose SQL (00001_init.up/down.sql)
│   ├── Makefile           # run/build/test/vet/lint/migrate-up/migrate-down
│   ├── Dockerfile         # multi-stage: golang → distroless
│   └── .env.example
├── frontend/              # SPA Vite React 19
│   ├── src/api/           # cliente HTTP (base /api, X-API-Key en dashboard)
│   ├── src/pages/         # Home, StoreDetail, Dashboard
│   ├── src/components/    # UI + appointments (PendingQueue, DayCalendar, agenda)
│   ├── Dockerfile         # multi-stage: node → nginx
│   ├── nginx.conf         # template: SPA fallback + proxy /api → backend
│   └── .env.example
├── docker-compose.yml     # stack local: postgres + backend + frontend
├── openspec/              # SDD: specs y cambios (incluye migracion-react-go)
└── sdd/                   # SDD: propuestas y diseños
```

## Requisitos

- Docker + Docker Compose v2 (recomendado para correr el stack completo)
- Go 1.26+ y Node.js 22+ (solo para desarrollo fuera de Docker)
- `make` (targets del backend)

## Correr en dev

### Opción A — Docker Compose (recomendado)

```bash
docker compose up --build -d
cd backend && make tools && make migrate-up   # primera vez: instala goose y aplica migraciones
```

- Frontend: http://localhost:3000 (nginx, proxy `/api` → backend)
- Backend: http://localhost:8080 (`/health`, `/api/*`)
- PostgreSQL: localhost:5432 (user/pass/db: `postgres`/`postgres`/`appointments`)

`make migrate-up` corre desde el host contra `localhost:5432` porque el servicio `postgres` publica el puerto. En un entorno nuevo la tabla `goose_db_version` se crea sola al migrar.

### Opción B — Sin Docker

```bash
# Terminal 1 — backend
cd backend
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/appointments?sslmode=disable
make migrate-up && make run

# Terminal 2 — frontend (Vite proxya /api → localhost:8080)
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173.

## Migraciones

Backend usa [goose](https://github.com/pressly/goose) (`backend/migrations/`):

```bash
cd backend
make tools          # instala goose una vez
make migrate-up     # aplica pendientes
make migrate-down   # revierte la última
```

Las migraciones se aplican contra `DATABASE_URL` (default: `postgres://postgres:postgres@localhost:5432/appointments?sslmode=disable`). En producción se aplican una vez durante el deploy; no hay migración de datos desde el stack viejo (DB nueva).

## Variables de entorno

### backend (`.env.example`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/appointments?sslmode=disable` | Cadena de conexión pgx |
| `PORT` | `8080` | Puerto HTTP |
| `API_KEY` | vacío | API key del dashboard (stub). Vacío = rutas owner sin protección |
| `OWNER_ID` | `dashboard-owner` | Owner fijo del dashboard de un solo dueño (stub) |
| `CORS_ORIGINS` | `http://localhost:5173` | Orígenes CORS separados por coma |
| `APP_URL` | `http://localhost:5173` | URL pública del frontend |

### frontend (`.env.example`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_API_URL` | vacío | Base de la API. Vacío = relativo `/api` (proxyeado por Vite en dev, por nginx en prod) |

`VITE_API_URL` se compila en el build: cambiarla requiere recompilar la imagen.

## Despliegue en Dokploy

Dos aplicaciones + un PostgreSQL compartido. No hay datos del stack viejo que migrar.

1. **PostgreSQL** — servicio (o base existente) con usuario/contraseña propios. Crear la DB, ej. `appointments`.
2. **Aplicación `backend`** — build del Dockerfile de `backend/`. Env:
   - `DATABASE_URL=postgres://<user>:<pass>@<postgres-host>:5432/appointments?sslmode=disable`
   - `API_KEY=<secret>` — **obligatoria en producción**: sin ella las rutas owner quedan sin protección
   - `CORS_ORIGINS=https://<dominio-frontend>`
   - `APP_URL=https://<dominio-frontend>`
   - `OWNER_ID` (opcional, default `dashboard-owner`)
   - Aplicar migraciones una vez: `goose -dir migrations postgres "$DATABASE_URL" up` (o un job de migración)
3. **Aplicación `frontend`** — build del Dockerfile de `frontend/`, dominio con TLS. El nginx embebido sirve el SPA y proxya `/api` → `backend` (por defecto `backend:8080`, configurable con `BACKEND_UPSTREAM`). Dokploy también permite configurar el proxy a nivel de aplicación, pero el nginx embebido es el default y funciona sin pasos extra.

### Nota sobre la API key stub

El dashboard autentica con una `X-API-Key` estática (`API_KEY`). Es un stub deliberado para no arrastrar el flujo OAuth del stack viejo: el contrato con el frontend ya está definido (`Authorization: Bearer` o `X-API-Key`), así que migrar a JWT/OAuth real no requiere tocar el cliente. No expongas `API_KEY` en variables de build del frontend; se manda desde el navegador en los requests del dashboard.

## Verificación rápida

```bash
curl http://localhost:8080/health        # {"status":"ok",...}
curl http://localhost:3000/              # HTML del SPA
curl http://localhost:3000/api/health    # a través del proxy nginx
```

## SDD Development Process

El proyecto se desarrolla con Spec-Driven Development (SDD). Artefactos en `openspec/` (specs + cambios, incluyendo `migracion-react-go`) y `sdd/`. Ver `openspec.md` y `tasks.md`.

## Mejoras futuras

- [ ] CI del stack nuevo (Go build/test/vet + frontend build/test en GitHub Actions)
- [ ] OAuth real para el dashboard (reemplazo del stub de API key)
- [ ] Rate limiting y paginación en el API Go
- [ ] Two-way Google Calendar sync
