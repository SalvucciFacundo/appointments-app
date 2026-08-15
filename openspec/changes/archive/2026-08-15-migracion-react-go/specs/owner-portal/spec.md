# Spec: owner-portal

## MODIFIED Requirements

### Requirement: Owner authentication via API key stub

Dashboard and owner routes SHALL authenticate with the static API key in `X-API-Key`. This is a temporary stub until the real auth (Google OAuth) phase; the frontend contract SHALL remain compatible with replacing the key with a real token later.

#### Scenario: Dashboard loads with API key

- **Given** the SPA is configured with the owner API key
- **When** the dashboard requests owner data
- **Then** requests SHALL include `X-API-Key` and SHALL succeed

#### Scenario: Dashboard without API key is rejected

- **Given** a request without a valid `X-API-Key`
- **When** the owner API validates it
- **Then** the response SHALL be `401`

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
