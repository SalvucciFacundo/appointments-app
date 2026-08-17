# Spec: owner-portal

## Requirements

### Requirement: Owner authentication via API key stub

El dashboard y las rutas owner SHALL autenticarse con sesión server-side (cookie httpOnly) y exigir `role = OWNER`. Durante la transición dual, el backend MAY aceptar `X-API-Key` (mapeada al owner bootstrap) si no hay sesión válida, deshabilitable con `AUTH_DISABLE_API_KEY`. El frontend SHALL usar `credentials: "include"`, SHALL redirigir a `/login` ante `401` y MUST NOT persistir credenciales en `localStorage`.

(Previously: la autenticación era un stub con `X-API-Key` estática y `OWNER_ID` fijo del config.)

#### Scenario: Dashboard autenticado por sesión

- **Given** un usuario `role = OWNER` con cookie de sesión válida
- **When** el dashboard solicita datos owner
- **Then** la petición procede con `200`

#### Scenario: Sin sesión ni API key

- **Given** un request sin cookie de sesión válida ni `X-API-Key`
- **When** se solicita una ruta owner
- **Then** responde `401` y la SPA redirige a `/login`

#### Scenario: Transición dual con API key

- **Given** `AUTH_DISABLE_API_KEY=false` y sin cookie de sesión
- **When** un request incluye `X-API-Key` válida
- **Then** se mapea al owner bootstrap y procede con advertencia de deprecación

#### Scenario: API key deshabilitada

- **Given** `AUTH_DISABLE_API_KEY=true`
- **When** un request usa `X-API-Key`
- **Then** responde `401`

### Requirement: Owner store CRUD

The dashboard SHALL support creating and editing a store: name, description, address, phone, specialty, latitude, longitude, `slotDuration`, `maxParallelBookings`, `maxSlotsPerDay`, `cancelationLimit`. Store creation SHALL auto-generate a unique slug.

#### Scenario: Owner creates a store

- **Given** an authenticated owner
- **When** they submit a new store
- **Then** the API SHALL return `201` with the store including a generated slug

#### Scenario: Owner updates store settings

- **Given** an existing store
- **When** the owner updates `slotDuration` and `maxParallelBookings`
- **Then** the API SHALL persist the new values

### Requirement: Business hours management

The dashboard SHALL display and edit business hours per day of week. Saving SHALL replace the full set of hours for the store (transactional delete + create).

#### Scenario: Owner saves business hours

- **Given** a store with hours Mon-Fri 09:00-18:00
- **When** the owner changes Monday to 10:00-16:00 and saves
- **Then** the API SHALL persist the full new set of hours

#### Scenario: Invalid time format is rejected

- **Given** an hours update with `openTime = "25:00"`
- **When** the owner saves
- **Then** the API SHALL return `400` with `field = "openTime"`

### Requirement: Blocked dates management

The dashboard SHALL support adding a blocked date (with optional reason) and removing it. Only future dates SHALL be accepted.

#### Scenario: Owner blocks a date

- **Given** an authenticated owner
- **When** they block a future date
- **Then** the API SHALL return `201` with the blocked date

#### Scenario: Past date is rejected

- **Given** an authenticated owner
- **When** they block a past date
- **Then** the API SHALL return `400`

### Requirement: Owner store list

The dashboard SHALL list the owner's stores with their business hours and blocked dates.

#### Scenario: Owner views their stores

- **Given** an owner with two stores
- **When** the dashboard requests `GET /api/stores`
- **Then** the response SHALL contain both stores with hours and blocked dates

### Requirement: Guard de ruta del dashboard

La SPA MUST proteger `/dashboard` con un guard de sesión: sin usuario autenticado SHALL redirigir a `/login`. El usuario actual MUST obtenerse de `GET /api/auth/me` al cargar.

#### Scenario: Usuario no autenticado accede a /dashboard

- **Given** sin sesión activa
- **When** la SPA navega a `/dashboard`
- **Then** redirige a `/login`

#### Scenario: OWNER accede a /dashboard

- **Given** un OWNER autenticado
- **When** navega a `/dashboard`
- **Then** la ruta se renderiza con los datos del owner