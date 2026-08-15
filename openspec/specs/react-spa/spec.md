# Spec: react-spa

## ADDED Requirements

### Requirement: Vite React SPA shell

The frontend SHALL be a React 19 SPA built with Vite, using `react-router` for client-side routing, under `frontend/`. It SHALL expose routes: `/` (landing), `/:slug` (store detail), `/dashboard` (owner dashboard).

#### Scenario: SPA serves landing at root

- **Given** the frontend is running
- **When** a user visits `/`
- **Then** the landing page SHALL render

#### Scenario: SPA serves store detail by slug

- **Given** a store with slug "mi-clinica"
- **When** a user visits `/mi-clinica`
- **Then** the store detail page SHALL render and fetch store data from the API

### Requirement: API client layer

The SPA SHALL contain an API client layer (`src/api/`) ported from `src/lib/stores.ts` and `src/lib/appointments.ts`, with all requests pointing to the backend base URL (`VITE_API_URL`), and the owner API key sent via `X-API-Key` header on dashboard requests.

### Requirement: Ported UI components

The SPA SHALL port the existing client components: `Button`, `Input`, `Card`, `Toast`, `Pagination`, `SearchBar`, `StoreCard`, `StarRating`, `DayCalendar`, `PendingQueue`, `TodayAgenda`, `AppointmentDetail`, and the design system from `src/app/globals.css`. Next.js-specific imports (`next/link`, `next/navigation`) SHALL be replaced with react-router equivalents.

### Requirement: Static build served via nginx

The frontend SHALL build to static assets served by nginx, with a reverse proxy from `/api` to the backend, so the SPA can use relative `/api` URLs in production.

#### Scenario: Build produces static assets

- **Given** the frontend source
- **When** `npm run build` runs
- **Then** a `dist/` directory SHALL be produced with `index.html` and hashed assets

### Requirement: Public pages fetch from API (no server components)

The landing and store detail pages SHALL be client components that fetch data from the backend API. Server Components / RSC SHALL NOT be used.

#### Scenario: Landing loads stores from API

- **Given** the backend is running with stores
- **When** the landing page mounts
- **Then** it SHALL fetch `GET /api/stores/public` and render the store grid
