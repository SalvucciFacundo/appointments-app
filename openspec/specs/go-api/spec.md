# Spec: go-api

## Requirements

### Requirement: REST API in Go with chi

The backend SHALL expose a REST API implemented in Go using `github.com/go-chi/chi/v5`, running as a single module under `backend/`. The API SHALL follow the canonical routing: `slug` for public endpoints, `id` for owner endpoints.

#### Scenario: API serves health check

- **Given** the backend is running
- **When** a client requests `GET /health`
- **Then** the response SHALL be `200 OK` with status `ok`

### Requirement: JSON error contract

El contrato `{"error":{code,message,field}}` SHALL mantenerse; `field` opcional. Códigos: `400` validación, `401` credenciales inválidas o sesión ausente/inválida/vencida, `403` rol insuficiente, ownership fallido o CSRF inválido, `404` no encontrado, `409` slot no disponible, `429` rate limit, `500` interno.

(Previously: `401` cubría solo "missing/invalid API key" y no existía `403`.)

#### Scenario: Error de sesión

- **Given** una cookie de sesión vencida o ausente
- **When** se solicita una ruta protegida
- **Then** responde `401` con `error.code = "unauthorized"`

#### Scenario: Rol insuficiente

- **Given** un usuario `USER` autenticado
- **When** solicita una ruta owner
- **Then** responde `403` con `error.code = "forbidden"`

### Requirement: CORS and rate limiting middleware

Con `credentials: "include"`, el CORS MUST usar orígenes exactos de `CORS_ORIGINS` con `Access-Control-Allow-Credentials: true`; MUST NOT usar `Access-Control-Allow-Origin: *`. El rate limiter in-memory SHALL clasificar en tier owner (30 requests/min) a los clientes autenticados por sesión y anónimos (10 requests/min) a los demás; `429` SHALL incluir `Retry-After`.

(Previously: CORS sin credenciales; el tier owner clasificaba solo por API key.)

#### Scenario: Sesión owner excede el rate limit

- **Given** un OWNER autenticado por sesión
- **When** supera 30 requests en un minuto
- **Then** responde `429` con `Retry-After`

#### Scenario: Anónimo en endpoint de auth

- **Given** un cliente anónimo
- **When** hace 11 requests a `/api/auth/*` en un minuto
- **Then** el 11º responde `429` con `Retry-After`

### Requirement: Paginated response contract

List endpoints SHALL return `{"data": [...], "page": <n>, "limit": <n>, "total": <n>, "totalPages": <n>}`, with `limit` capped at 100.

### Requirement: API key stub for owner routes

Durante la transición, las rutas owner SHALL aceptar una sesión válida; si no hay sesión, MAY aceptar `X-API-Key` configurada por env `API_KEY`. La API key MUST mapearse al owner bootstrap y el fallback MUST deshabilitarse con `AUTH_DISABLE_API_KEY=true`. Sin sesión ni API key válida MUST responder `401`.

(Previously: las rutas owner requerían exclusivamente la API key estática.)

#### Scenario: Ruta owner con sesión válida

- **Given** un OWNER con cookie de sesión
- **When** solicita una ruta owner sin `X-API-Key`
- **Then** procede con `200`

#### Scenario: Ruta owner sin credenciales

- **Given** sin sesión y sin `X-API-Key`
- **When** se solicita una ruta owner
- **Then** responde `401` `unauthorized`

#### Scenario: Fallback con API key válida

- **Given** sin sesión y `AUTH_DISABLE_API_KEY=false`
- **When** se envía `X-API-Key` válida
- **Then** procede mapeando al owner bootstrap