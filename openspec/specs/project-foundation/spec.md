# Spec: project-foundation

## MODIFIED Requirements

### Requirement: Repository layout

The repository SHALL be organized as a monorepo with `frontend/` (Vite React SPA) and `backend/` (Go API), plus deployment files. The Next.js stack (src/, prisma/, next.config.ts, etc.) SHALL be removed.

#### Scenario: Repository contains frontend and backend

- **Given** the repository root
- **Then** it SHALL contain `frontend/`, `backend/`, and deployment files
- **And** SHALL NOT contain Next.js application files (`src/app`, `next.config.ts`, `prisma/schema.prisma`)

### Requirement: Go module structure

The Go backend SHALL be a single module at `backend/` with: `cmd/api` (entrypoint), `internal/http` (router, middleware, handlers), `internal/service` (business logic), `internal/store` (pgx repository), `internal/config` (env config), and `migrations/` (goose SQL).

### Requirement: Database schema via goose migrations

The database SHALL be created with goose migrations under `backend/migrations/`, using `schema.prisma` as the source of truth for the core models: `users`, `stores`, `business_hours`, `blocked_dates`, `appointments`, and the `appointment_status` enum (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`). IDs SHALL be UUID v4 generated in Go.

#### Scenario: Fresh database initializes

- **Given** an empty PostgreSQL database
- **When** goose migrations run
- **Then** all core tables and the status enum SHALL exist with the defined columns and indexes (`stores.slug` unique, `stores(owner_id)` index, `appointments(store_id, date_time)` index)

#### Scenario: Appointment status enum matches state machine

- **Given** the `appointment_status` enum
- **Then** it SHALL contain exactly `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`

### Requirement: Appointment timestamps stored as timestamptz

The `appointments.date_time` column SHALL be `timestamptz`. All date/time values SHALL be stored in UTC and converted to the store timezone at the API boundary.

### Requirement: Non-operational settings preserved

The `stores.cancelation_limit` column SHALL exist in the schema for compatibility, but SHALL NOT be enforced by any endpoint in this phase.

### Requirement: Local development with docker-compose

A root `docker-compose.yml` SHALL define the local dev stack: PostgreSQL, backend (Go, hot-reload optional), and frontend (Vite dev server).

#### Scenario: Local stack starts

- **Given** docker installed
- **When** `docker compose up` runs
- **Then** postgres, backend, and frontend services SHALL start and be reachable

### Requirement: Production deployment files

The repository SHALL include a Dockerfile for the frontend (build → nginx static with `/api` proxy) and a multi-stage Dockerfile for the backend (build → distroless/alpine runtime), plus env examples for both apps.

#### Scenario: Backend image builds

- **Given** the backend Dockerfile
- **When** `docker build` runs on `backend/`
- **Then** a minimal runtime image with the API binary SHALL be produced

#### Scenario: Frontend image builds

- **Given** the frontend Dockerfile
- **When** `docker build` runs on `frontend/`
- **Then** an nginx image serving the static build SHALL be produced
