# Owner Appointments Specification

## Purpose

Owner-facing appointment management: list, filter, confirm/reject PENDING appointments, reschedule with slot validation, and view day calendar. Covers API endpoints and dashboard UI components.

## Requirements

### Requirement: List Appointments API

GET `/api/stores/[storeId]/appointments` MUST support optional `date` (YYYY-MM-DD) and `status` query parameters. The endpoint MUST return appointments sorted by `dateTime` ascending. Each appointment MUST include client info (`clientName`, `clientPhone`, `clientEmail`). The endpoint MUST return 403 if the caller is not the store owner.

#### Scenario: List all appointments

- GIVEN an OWNER with store `abc` and 5 appointments
- WHEN GET `/api/stores/abc/appointments`
- THEN the response is 200 with all 5 appointments sorted by `dateTime` ascending
- AND each appointment includes `clientName`, `clientPhone`, `clientEmail`

#### Scenario: Filter by date

- GIVEN an OWNER with appointments on 2026-07-15 and 2026-07-16
- WHEN GET `/api/stores/abc/appointments?date=2026-07-15`
- THEN only appointments on 2026-07-15 are returned

#### Scenario: Filter by status

- GIVEN an OWNER with 3 PENDING and 2 CONFIRMED appointments
- WHEN GET `/api/stores/abc/appointments?status=PENDING`
- THEN only the 3 PENDING appointments are returned

#### Scenario: Non-owner access denied

- GIVEN OWNER-A with store `abc`
- WHEN OWNER-B calls GET `/api/stores/abc/appointments`
- THEN the response is 403

---

### Requirement: Status Transitions API

PUT `/api/stores/[storeId]/appointments/[id]` with `action` body parameter MUST enforce the state machine: PENDING→CONFIRMED, PENDING→CANCELLED, CONFIRMED→COMPLETED, CONFIRMED→CANCELLED. Invalid transitions MUST return 400. The endpoint MUST return 403 if the caller is not the store owner.

#### Scenario: Confirm PENDING appointment

- GIVEN a PENDING appointment with id `apt-1`
- WHEN PUT `/api/stores/abc/appointments/apt-1` with `action: "CONFIRM"`
- THEN the appointment status becomes CONFIRMED
- AND the response is 200 with the updated appointment

#### Scenario: Reject PENDING appointment

- GIVEN a PENDING appointment with id `apt-1`
- WHEN PUT `/api/stores/abc/appointments/apt-1` with `action: "REJECT"`
- THEN the appointment status becomes CANCELLED
- AND the response is 200

#### Scenario: Complete CONFIRMED appointment

- GIVEN a CONFIRMED appointment with id `apt-2`
- WHEN PUT with `action: "COMPLETE"`
- THEN the appointment status becomes COMPLETED
- AND the response is 200

#### Scenario: Invalid transition

- GIVEN a COMPLETED appointment with id `apt-3`
- WHEN PUT with `action: "CONFIRM"`
- THEN the response is 400 with error message "Invalid status transition"

---

### Requirement: Reschedule API

PUT `/api/stores/[storeId]/appointments/[id]/reschedule` with `dateTime` body parameter MUST validate slot availability: the new time MUST be within business hours, MUST NOT be on a blocked date, and MUST NOT exceed `maxParallelBookings` capacity. The endpoint MUST return the updated appointment. Invalid slots MUST return 400.

#### Scenario: Reschedule to available slot

- GIVEN a CONFIRMED appointment at 2026-07-15T10:00:00
- WHEN PUT reschedule with `dateTime: "2026-07-15T14:00:00"` and the slot is available
- THEN the appointment is updated to the new time
- AND the response is 200

#### Scenario: Reschedule to blocked date

- GIVEN a blocked date on 2026-07-20
- WHEN PUT reschedule with `dateTime: "2026-07-20T10:00:00"`
- THEN the response is 400 with error "Date is blocked"

#### Scenario: Reschedule outside business hours

- GIVEN business hours 09:00-18:00
- WHEN PUT reschedule with `dateTime: "2026-07-15T20:00:00"`
- THEN the response is 400 with error "Outside business hours"

#### Scenario: Reschedule exceeds capacity

- GIVEN `maxParallelBookings: 1` and an existing appointment at 2026-07-15T14:00:00
- WHEN PUT reschedule with `dateTime: "2026-07-15T14:00:00"` for another appointment
- THEN the response is 400 with error "Slot capacity exceeded"

---

### Requirement: PENDING Queue UI

The dashboard SHALL display a PENDING appointments section. Each PENDING appointment SHALL show a `wa.me` link with pre-filled message (name, phone, service, time). Each appointment SHALL have Confirm and Reject buttons.

#### Scenario: View PENDING queue

- GIVEN an OWNER with 3 PENDING appointments
- WHEN the dashboard loads
- THEN the PENDING section displays all 3 appointments
- AND each shows name, phone, service, time, and a `wa.me` link

#### Scenario: Click wa.me link

- GIVEN a PENDING appointment for "Juan" at 2026-07-15T10:00
- WHEN the owner clicks the `wa.me` link
- THEN WhatsApp opens with message "Hi Juan, your appointment for [service] on 2026-07-15 at 10:00"

#### Scenario: Confirm from queue

- GIVEN a PENDING appointment in the queue
- WHEN the owner clicks Confirm
- THEN the appointment status becomes CONFIRMED
- AND it is removed from the PENDING queue

#### Scenario: Reject from queue

- GIVEN a PENDING appointment in the queue
- WHEN the owner clicks Reject
- THEN the appointment status becomes CANCELLED
- AND it is removed from the PENDING queue

---

### Requirement: Today's Agenda UI

The dashboard SHALL display a Today's Agenda section showing today's appointments grouped by status (CONFIRMED, PENDING, COMPLETED, CANCELLED). Each appointment SHALL show time, client name, and service.

#### Scenario: View today's agenda

- GIVEN an OWNER with 2 CONFIRMED and 1 PENDING appointment today
- WHEN the dashboard loads
- THEN the Today's Agenda section shows appointments grouped by status
- AND each appointment shows time, client name, and service

#### Scenario: Empty agenda

- GIVEN an OWNER with no appointments today
- WHEN the dashboard loads
- THEN the Today's Agenda section shows "No appointments today"

---

### Requirement: Day Calendar UI

The dashboard SHALL display a day calendar showing a time grid from store open to close. Appointments SHALL be rendered as time-positioned blocks colored by status (PENDING: yellow, CONFIRMED: green, COMPLETED: gray, CANCELLED: red).

#### Scenario: View day calendar

- GIVEN a store with hours 09:00-18:00 and 3 appointments today
- WHEN the dashboard loads
- THEN the day calendar shows a time grid from 09:00 to 18:00
- AND each appointment is rendered as a block at its time position
- AND blocks are colored by status

#### Scenario: Calendar respects store timezone

- GIVEN a store with timezone "America/Argentina/Buenos_Aires"
- WHEN the day calendar renders
- THEN times are displayed in the store's timezone
