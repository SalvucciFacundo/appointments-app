# Spec: store-booking

## MODIFIED Requirements

### Requirement: Public store detail via API

The store detail page SHALL fetch `GET /api/stores/public/{slug}` and display name, description, address, phone, specialty, timezone, and business hours.

#### Scenario: Store page renders from API

- **Given** a store with slug "mi-clinica" exists
- **When** a user visits `/mi-clinica`
- **Then** the page SHALL render the store info and business hours fetched from the API

#### Scenario: Non-existent slug returns 404

- **Given** no store with slug "inexistente" exists
- **When** a user requests `GET /api/stores/public/inexistente`
- **Then** the API SHALL return `404`

### Requirement: Booking with date+time contract

The SPA SHALL send `{date: "YYYY-MM-DD", time: "HH:MM", clientName, clientPhone, clientEmail, service?, notes?}` to `POST /api/stores/{slug}/book`. The backend SHALL interpret date/time in the store's timezone. Without authentication, the appointment SHALL be created with status `PENDING` and a generated `managementToken`.

#### Scenario: Anonymous user books an available slot

- **Given** an anonymous user
- **When** they submit a valid booking for an available slot
- **Then** the API SHALL return `201` with the appointment
- **And** the appointment status SHALL be `PENDING`
- **And** a `managementToken` SHALL be generated

#### Scenario: Booking an unavailable slot returns 409

- **Given** a slot at max capacity
- **When** a user books that exact slot
- **Then** the API SHALL return `409` with `error.code = "slot_unavailable"`

#### Scenario: Booking is atomic under concurrency

- **Given** one slot with `maxParallelBookings = 1`
- **When** two clients book the same slot concurrently
- **Then** exactly one request SHALL succeed with `201` and the other SHALL return `409`

### Requirement: Available slots computed in Go

The `GET /api/stores/{slug}/slots?date=YYYY-MM-DD` endpoint SHALL compute slots with the store's timezone (`time.LoadLocation`), business hours, blocked dates, and existing appointments. Slots SHALL be windows of `slotDuration` minutes from `openTime` to `closeTime`, including only windows where `start + slotDuration <= closeTime`.

#### Scenario: Slots respect business hours

- **Given** a store open Mon-Fri 09:00-17:00 with 60-min slots
- **When** a user requests slots for a Wednesday
- **Then** the response SHALL contain 8 slots (09:00-10:00 through 16:00-17:00)

#### Scenario: Blocked date returns no slots

- **Given** a store with a blocked date on 2026-07-20
- **When** a user requests slots for 2026-07-20
- **Then** the response SHALL be an empty array

#### Scenario: Cancelled appointments do not occupy capacity

- **Given** a store with `maxParallelBookings = 1`
- **And** an appointment at 10:00 with status `CANCELLED`
- **When** a user requests slots for that date
- **Then** the 10:00 slot SHALL have `available: true`

#### Scenario: Completed appointments occupy capacity

- **Given** a store with `maxParallelBookings = 1`
- **And** an appointment at 10:00 with status `COMPLETED`
- **When** a user requests slots for that date
- **Then** the 10:00 slot SHALL have `available: false`

#### Scenario: Slots use store timezone with DST safety

- **Given** a store in "America/Argentina/Buenos_Aires"
- **When** a user requests slots for a date
- **Then** the daily window SHALL be computed with `time.AddDate` (not `Add(24h)`) so DST transitions are safe

### Requirement: Max slots per day

When `maxSlotsPerDay > 0`, slots SHALL be unavailable once the day's total bookings reach `maxSlotsPerDay`.

#### Scenario: Daily limit reached

- **Given** a store with `maxSlotsPerDay = 2` and 2 existing bookings that day
- **When** a user requests slots for that date
- **Then** all slots SHALL have `available: false`
