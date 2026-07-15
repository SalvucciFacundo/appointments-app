# Owner Portal Specification

## Purpose

Store onboarding flow and configuration management for service-store owners. Covers the API contract for store CRUD, business hours, blocked dates, and the UI surfaces (onboarding + dashboard) that consume them.

## Requirements

### Requirement: Store Onboarding API

POST `/api/stores` MUST create a store, update the authenticated user's role to `OWNER`, and return the created store. The system MUST auto-generate a URL-safe `slug` from the store `name`. The endpoint MUST validate that `name`, `description`, `address`, `phone`, and `specialty` are present and non-empty. On slug collision the endpoint MUST return 409 with the conflicting slug.

#### Scenario: Successful store creation

- GIVEN an authenticated USER with no existing store
- WHEN POST `/api/stores` with valid `{ name, description, address, phone, specialty }`
- THEN a Store record is created with an auto-generated slug
- AND the user's role is updated to OWNER
- AND the response is 201 with the store object

#### Scenario: Missing required field

- GIVEN an authenticated USER
- WHEN POST `/api/stores` with `name` omitted
- THEN the response is 400 with a validation error listing `name`

#### Scenario: Slug collision

- GIVEN a store with slug `mi-tienda` already exists
- WHEN POST `/api/stores` with `name: "Mi Tienda"`
- THEN the response is 409

---

### Requirement: Store Read/Update API

GET `/api/stores/[storeId]` MUST return the store settings. PUT `/api/stores/[storeId]` MUST update store settings. GET `/api/stores/current` MUST return the authenticated OWNER's store. All endpoints MUST return 403 if the caller is not the store owner.

#### Scenario: Owner reads own store

- GIVEN an OWNER with store id `abc`
- WHEN GET `/api/stores/abc`
- THEN the response is 200 with the store object

#### Scenario: Non-owner access denied

- GIVEN OWNER-A with store `abc`
- WHEN OWNER-B calls GET `/api/stores/abc`
- THEN the response is 403

#### Scenario: Current store shortcut

- GIVEN an authenticated OWNER
- WHEN GET `/api/stores/current`
- THEN the response is 200 with that owner's store

---

### Requirement: Business Hours API

PUT `/api/stores/[storeId]/hours` MUST accept an array of `BusinessHour` records. Each record MUST contain `dayOfWeek` (integer 0–6) and `open`/`close` times in `HH:MM` format. The system MUST reject records with invalid day or time values with a 400 response.

#### Scenario: Set full-week hours

- GIVEN an OWNER with store `abc`
- WHEN PUT `/api/stores/abc/hours` with 7 valid day records
- THEN all 7 records are persisted and 200 is returned

#### Scenario: Invalid dayOfWeek

- GIVEN an OWNER
- WHEN PUT with `dayOfWeek: 8`
- THEN the response is 400

#### Scenario: Invalid time format

- GIVEN an OWNER
- WHEN PUT with `open: "9am"`
- THEN the response is 400

---

### Requirement: Blocked Dates API

POST `/api/stores/[storeId]/blocked-dates` MUST add a blocked date with `date` and `reason`. The system MUST validate the date is in the future. DELETE `/api/stores/[storeId]/blocked-dates/[id]` MUST remove the blocked date. Both endpoints MUST enforce owner access.

#### Scenario: Add future blocked date

- GIVEN an OWNER and date `2026-12-25` is in the future
- WHEN POST with `{ date: "2026-12-25", reason: "Holiday" }`
- THEN 201 is returned with the created record

#### Scenario: Reject past date

- GIVEN an OWNER
- WHEN POST with a date in the past
- THEN the response is 400

#### Scenario: Remove blocked date

- GIVEN a blocked date with id `bd-1`
- WHEN DELETE `/api/stores/abc/blocked-dates/bd-1`
- THEN the record is removed and 204 is returned

---

### Requirement: Dashboard UI

`/dashboard` SHALL display store info, business hours, slot configuration, blocked dates, and cancellation policy. Each section SHALL support inline editing. The page MUST redirect non-OWNERs to `/onboarding`.

#### Scenario: Owner views dashboard

- GIVEN an authenticated OWNER with a configured store
- WHEN navigating to `/dashboard`
- THEN all configuration sections are visible with current values

#### Scenario: Inline edit business hours

- GIVEN the dashboard is loaded
- WHEN the owner edits a day's open/close times and saves
- THEN the updated hours are persisted and displayed

#### Scenario: Non-owner redirected

- GIVEN an authenticated USER (not OWNER)
- WHEN navigating to `/dashboard`
- THEN the user is redirected to `/onboarding`

---

### Requirement: Onboarding UI

`/onboarding` SHALL provide a form for store creation with fields: name, description, address, phone, specialty. The form MUST display validation errors inline. On successful creation the page MUST redirect to `/dashboard`.

#### Scenario: Complete onboarding

- GIVEN an authenticated USER at `/onboarding`
- WHEN all fields are filled and the form is submitted
- THEN the store is created and the user is redirected to `/dashboard`

#### Scenario: Validation error display

- GIVEN the onboarding form
- WHEN submitted with empty `name`
- THEN an inline error message is shown for `name`

#### Scenario: Resume incomplete onboarding

- GIVEN a USER who abandoned onboarding mid-flow
- WHEN returning to `/onboarding`
- THEN previously entered values are restored
