# Tasks: migracion-react-go

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~6,500–8,000 (incl. ~4,500 deletions de `src/`) |
| Session review budget | 800 líneas |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 7 (cadena feature-branch) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: No (resolved: chained PRs, feature-branch-chain, budget 800)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend skeleton + goose schema | PR 1 | `go build ./...` | `goose up` en DB vacía (postgres docker-compose) | Revertir `backend/`; `src/` intacto |
| 2 | Store pgx + service puro (validators/slug/pagination) | PR 2 | `go test ./internal/store/ ./internal/service/` | N/A — lógica pura y pgxmock, sin DB real | Revertir `internal/store/`+`internal/service/` |
| 3 | Slots + state machine + booking tx | PR 3 | `go test -race ./internal/service/ -run 'Slots|StateMachine|Book'` | N/A — pgxmock (testcontainers opcional) | Revertir service + tests |
| 4 | HTTP router/middleware/handlers | PR 4 | `go test ./internal/http/...` | `go run ./cmd/api` + curl `/health`, `/api/stores/public` | Revertir `internal/http/` |
| 5 | SPA shell + api layer + design system | PR 5 | `npm run build` | `npm run dev` + proxy vite `/api` | Eliminar `frontend/` |
| 6 | Componentes portados + páginas | PR 6 | `npm run build && npx vitest run` | `npm run dev`; revisar `/`, `/:slug`, `/dashboard` | Revertir `frontend/src/` |
| 7 | Deploy + cleanup + push | PR 7 | `docker compose up` + `curl localhost:8080/health` | `docker compose up` stack completo | `git revert` del commit de corte restaura `src/` |

## Phase 1: Foundation (backend skeleton + DB)

- [x] 1.1 Crear `backend/go.mod` + `cmd/api/main.go` + `internal/config/config.go` (env DATABASE_URL/PORT/API_KEY/CORS_ORIGINS/APP_URL) → `go build ./...`
- [x] 1.2 Crear `backend/migrations/00001_init.{up,down}.sql` (enum + users/stores/business_hours/blocked_dates/appointments + índices) → `goose up` produce schema = `prisma db push`; down revierte
- [x] 1.3 Crear `backend/Makefile` (run/build/test/migrate) + `.golangci.yml` → `make test`, lint ok

## Phase 2: Store + business logic pura

- [x] 2.1 Crear `internal/store/store.go` (pgxpool + structs) y `{stores,appointments,hours,blocked_dates}.go` (queries parametrizadas; list público con q ILIKE; window local en SQL) → `go vet ./...`
- [x] 2.2 Portar `internal/service/{validators,slug,pagination}.go` desde `src/lib/*.ts` + tests → verdes
- [x] 2.3 RED→GREEN `internal/service/slots.go` + `slots_test.go` (8 slots 09-17, blocked date, CANCELLED no ocupa, COMPLETED ocupa, maxSlotsPerDay, DST con AddDate) → `go test -run Slots`

## Phase 3: Booking + state machine

- [x] 3.1 RED→GREEN `internal/service/state_machine.go` + tests (transiciones, terminales, action case-insensitive, `field="action"`) → `go test -run StateMachine`
- [x] 3.2 RED→GREEN `internal/service/booking.go` (tx + `SELECT ... FOR UPDATE` store; revalidar slot) + `booking_test.go` (10 goroutines, 1 slot → 1×201, 9×409) → `go test -race -run Book` (D: 2.3)

## Phase 4: HTTP API

- [ ] 4.1 Crear `internal/http/middleware/*.go` (cors, logging, recover, ratelimit 10/30 rpm + Retry-After, requireapikey) → tests 429 anónimo, 401 sin key
- [ ] 4.2 Crear `internal/http/router.go` + error contract `{"error":{code,message,field}}` → httptest `/health` 200, 404 slug, 409 `slot_unavailable`
- [ ] 4.3 Crear handlers owner `stores.go`, `hours.go` (reemplazo tx), `blocked_dates.go` (solo futuro), `appointments.go` (GET/POST, PUT action, reschedule excluyéndose) → httptest 400 `field="action"`, 404 cross-store (D: 3.1)

## Phase 5: Frontend SPA

- [ ] 5.1 Scaffold `frontend/` (React 19, vite.config.ts proxy `/api`, react-router, index.html meta) → `npm run build` produce dist/
- [ ] 5.2 Crear `frontend/src/api/{client,stores,appointments}.ts` (ports de `src/lib/*.ts`; X-API-Key en dashboard) → build ok
- [ ] 5.3 Portar `components/ui/*` + `components/appointments/*` + `globals.css` (next/link → react-router) → build + vitest smoke
- [ ] 5.4 Crear `pages/{Home,StoreDetail,Dashboard}.tsx` (fetch en useEffect, sin RSC; PendingQueue/DayCalendar/agenda) → build + vitest

## Phase 6: Deploy + cleanup

- [ ] 6.1 Crear `backend/Dockerfile` (multi-stage → distroless), `frontend/Dockerfile` + `frontend/nginx.conf` (proxy `/api`) → `docker build` ambos ok
- [ ] 6.2 Crear `docker-compose.yml` (postgres + backend + frontend) + `.env.example` ×2 → `docker compose up` reachable
- [ ] 6.3 Reescribir `README.md`; actualizar `AGENTS.md`/`.gitignore` → docs reflejan stack nuevo
- [ ] 6.4 Eliminar `src/`, `prisma/`, `next.config.ts`, `package*.json`, `tsconfig.json`, `postcss/eslint/vitest` configs → `git status` sin Next.js (D: verificación previa)
- [ ] 6.5 Push a `SalvucciFacundo/appointments-app` (rama feature/chain)
