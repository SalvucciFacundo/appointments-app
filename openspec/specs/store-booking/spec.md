# Spec: store-booking

## ADDED Requirements

### Requirement: Store detail page

The store page (`/[slug]`) SHALL display:
- Store name, description, address, phone, specialty
- Business hours for each day of the week
- An interactive slot calendar for selecting a date and viewing available slots

The store info section SHALL be a Server Component. The slot calendar and booking form SHALL be Client Components.

#### Scenario: Store page renders store information

- **Given** a store with slug "mi-clinica" exists with business hours Mon-Fri 09:00-18:00
- **When** a user visits `/mi-clinica`
- **Then** the page SHALL display the store name, address, specialty, and business hours

#### Scenario: Non-existent slug returns 404

- **Given** no store with slug "inexistente" exists
- **When** a user visits `/inexistente`
- **Then** the page SHALL return a 404 Not Found response

---

### Requirement: Booking creates appointment with correct status

The booking endpoint SHALL create an appointment with status determined by authentication:
- Authenticated user (valid session) → status `CONFIRMED`, `userId` linked
- Anonymous user (no session) → status `PENDING`, `clientEmail` stored

#### Scenario: Authenticated user books a slot

- **Given** an authenticated user with a valid session
- **When** they submit a booking for an available slot
- **Then** an appointment SHALL be created with status `CONFIRMED`
- **And** the `userId` field SHALL be set to the authenticated user's ID

#### Scenario: Anonymous user books a slot

- **Given** an anonymous user (no session)
- **When** they submit a booking with name, phone, and email for an available slot
- **Then** an appointment SHALL be created with status `PENDING`
- **And** the `clientEmail` field SHALL be stored
- **And** the `userId` field SHALL be null

---

### Requirement: Available slots computation

Available slots SHALL be computed using the store's:
- Timezone (for local date/time conversion)
- Business hours (open/close times per day of week)
- Blocked dates (excluded dates)
- Existing appointments (capacity check per slot)

The computation SHALL reuse the existing `getAvailableSlots()` function from `src/lib/slots.ts`.

#### Scenario: Slots respect business hours

- **Given** a store open Mon-Fri 09:00-17:00 with 60-min slots
- **When** a user requests slots for a Wednesday
- **Then** the response SHALL contain 8 slots (09:00-10:00 through 16:00-17:00)

#### Scenario: Blocked date returns no slots

- **Given** a store with a blocked date on 2026-07-20
- **When** a user requests slots for 2026-07-20
- **Then** the response SHALL be an empty array

#### Scenario: Slot at max capacity is unavailable

- **Given** a store with maxParallelBookings=1 and one existing appointment at 10:00
- **When** a user requests slots for that date
- **Then** the 10:00 slot SHALL have `available: false`
- **And** all other slots SHALL have `available: true`

#### Scenario: Slots use store timezone

- **Given** a store in timezone "America/Argentina/Buenos_Aires" (UTC-3)
- **When** a user requests slots for 2026-07-20
- **Then** existing appointments SHALL be converted to local time before capacity check
