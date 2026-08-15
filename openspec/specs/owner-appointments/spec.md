# Spec: owner-appointments

## MODIFIED Requirements

### Requirement: Appointment listing with date filter

The dashboard SHALL list appointments for a store, filterable by date (interpreted in the store's timezone) and by status. The API SHALL resolve the local-day window in SQL using the store timezone.

#### Scenario: Owner lists appointments for a day

- **Given** a store with appointments across multiple days
- **When** the owner requests appointments for a specific date
- **Then** only that day's appointments (in store timezone) SHALL be returned, ordered by `dateTime` ascending

### Requirement: Owner creates an appointment manually

The owner SHALL be able to create an appointment manually. Status SHALL default to `CONFIRMED`. Validation of availability SHALL apply unless the owner explicitly overrides (same behavior as current app).

### Requirement: Appointment status state machine

The API SHALL expose a status transition endpoint `PUT /api/stores/{id}/appointments/{aid}` accepting `{action: CONFIRM|REJECT|COMPLETE}`. Valid transitions:
- `PENDING → CONFIRMED` (CONFIRM) | `PENDING → CANCELLED` (REJECT)
- `CONFIRMED → COMPLETED` (COMPLETE) | `CONFIRMED → CANCELLED` (REJECT)
- `CANCELLED` and `COMPLETED` are terminal

Invalid transitions SHALL return `400` with `field = "action"`.

#### Scenario: Confirm a pending appointment

- **Given** an appointment with status `PENDING`
- **When** the owner sends `{action: "CONFIRM"}`
- **Then** the status SHALL become `CONFIRMED`

#### Scenario: Reject a pending appointment

- **Given** an appointment with status `PENDING`
- **When** the owner sends `{action: "REJECT"}`
- **Then** the status SHALL become `CANCELLED`

#### Scenario: Complete a confirmed appointment

- **Given** an appointment with status `CONFIRMED`
- **When** the owner sends `{action: "COMPLETE"}`
- **Then** the status SHALL become `COMPLETED`

#### Scenario: Invalid transition from terminal state

- **Given** an appointment with status `COMPLETED`
- **When** the owner sends `{action: "CONFIRM"}`
- **Then** the API SHALL return `400` with `error.field = "action"`

#### Scenario: Action on appointment of another store is not found

- **Given** an appointment belonging to a different store
- **When** the owner sends an action to it via their store
- **Then** the API SHALL return `404`

### Requirement: Reschedule with slot validation

The API SHALL support rescheduling `PUT /api/stores/{id}/appointments/{aid}/reschedule` with `{date, time}`. It SHALL revalidate business hours, blocked dates, and capacity, excluding the appointment being rescheduled from the capacity count.

#### Scenario: Owner reschedules to an available slot

- **Given** an appointment and an available target slot
- **When** the owner reschedules to it
- **Then** the appointment SHALL be updated with the new `dateTime`

#### Scenario: Reschedule to unavailable slot returns 400

- **Given** a target slot at max capacity
- **When** the owner reschedules to it
- **Then** the API SHALL return `400` with a slot-unavailable error

### Requirement: PENDING queue and day calendar in dashboard

The dashboard SHALL render the `PendingQueue` (PENDING appointments with contact links) and `DayCalendar` (status-colored time blocks) using the ported components, fed by the owner appointments API.

#### Scenario: Pending queue shows pending appointments

- **Given** appointments in `PENDING` status
- **When** the dashboard renders the PendingQueue
- **Then** each pending appointment SHALL be listed with its client info and a contact link

#### Scenario: Day calendar colors by status

- **Given** appointments in different statuses
- **When** the dashboard renders the DayCalendar for a date
- **Then** time blocks SHALL be colored according to appointment status
