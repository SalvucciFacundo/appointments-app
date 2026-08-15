# Spec: go-api

## ADDED Requirements

### Requirement: REST API in Go with chi

The backend SHALL expose a REST API implemented in Go using `github.com/go-chi/chi/v5`, running as a single module under `backend/`. The API SHALL follow the canonical routing: `slug` for public endpoints, `id` for owner endpoints.

#### Scenario: API serves health check

- **Given** the backend is running
- **When** a client requests `GET /health`
- **Then** the response SHALL be `200 OK` with status `ok`

### Requirement: JSON error contract

All API error responses SHALL use a consistent JSON shape: `{"error": {"code": "<code>", "message": "<message>", "field": "<field>"}}` where `field` is optional. HTTP status codes SHALL be: `400` validation, `401` missing/invalid API key, `404` not found, `409` slot unavailable, `429` rate limited, `500` internal.

#### Scenario: Validation error shape

- **Given** a request with an invalid field
- **When** the API validates it
- **Then** the response SHALL be `400` with `error.code`, `error.message`, and `error.field` populated

### Requirement: CORS and rate limiting middleware

The API SHALL apply CORS middleware allowing the frontend origin (configurable via `CORS_ORIGINS`), and an in-memory rate limiter: anonymous clients 10 requests/minute, owner/API-key clients 30 requests/minute, with `Retry-After` header on `429`.

#### Scenario: Anonymous client exceeds rate limit

- **Given** an anonymous client
- **When** they make 11 requests in under a minute
- **Then** the 11th request SHALL return `429` with a `Retry-After` header

### Requirement: Paginated response contract

List endpoints SHALL return `{"data": [...], "page": <n>, "limit": <n>, "total": <n>, "totalPages": <n>}`, with `limit` capped at 100.

### Requirement: API key stub for owner routes

Owner routes SHALL require a static API key in the `X-API-Key` header, configured via env `API_KEY`. Requests without a matching key SHALL return `401`.

#### Scenario: Owner route without key is rejected

- **Given** no `X-API-Key` header
- **When** a client requests an owner route
- **Then** the response SHALL be `401` with `error.code = "unauthorized"`

#### Scenario: Owner route with valid key is allowed

- **Given** an `X-API-Key` header matching the configured key
- **When** a client requests an owner route
- **Then** the request SHALL proceed past authentication
