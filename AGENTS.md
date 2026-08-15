# Appointments App — Monorepo (React SPA + Go API)

Stack actual: `frontend/` (React 19 + Vite SPA) + `backend/` (Go REST API) + PostgreSQL, con `docker-compose.yml` para dev local. El monolito Next.js original fue eliminado en la migración (ver `openspec/changes/migracion-react-go/`).

## Backend Go (`backend/`)

- Go 1.26, chi router, pgx v5, migraciones goose en `backend/migrations/`.
- Arquitectura por capas en `internal/`:
  - `store/` — queries pgx **parametrizadas**, nunca interpolación SQL.
  - `service/` — lógica pura (slots, state machine, validators, pagination) con tests unitarios sin DB.
  - `http/` — router chi + middleware (cors, logging, recover, ratelimit, requireapikey), error contract `{"error":{code,message,field}}`.
  - `config/` — env: `DATABASE_URL`, `PORT`, `API_KEY`, `CORS_ORIGINS`, `APP_URL`, `OWNER_ID`.
- `time/tzdata` se embebe con blank import en `service/` (los slots son timezone-aware y corren en imágenes distroless).
- Comandos: `make test`, `make vet`, `make lint` (golangci-lint), `make migrate-up/down`.

## Frontend Vite (`frontend/`)

- React 19 + TypeScript + Tailwind v4 + react-router. Build: `tsc && vite build`.
- API vía `src/api/*` con base relativa `/api` (proxy Vite en dev, proxy nginx en prod). El dashboard manda `X-API-Key`.
- `npm run dev` (proxy `/api` → localhost:8080), `npm run build`, `npm run test` (vitest).

## Convenciones

- Conventional commits, sin co-authored-by ni atribuciones AI.
- No editar artefactos SDD (`openspec/`, `sdd/`) salvo que la tarea lo pida explícitamente.
- Regla general del repo: código de producción en inglés; mensajes de UI y docs pueden ir en español si el proyecto lo usa (los copy de la UI actual están en español).
