# Spec: customer-profile

## ADDED Requirements

### Requirement: Appointment history page

The `/perfil` page SHALL display the authenticated user's appointment history.

Appointments SHALL be ordered by date descending and include store name, date/time, status, and service.

#### Scenario: Authenticated user sees their appointments

- **Given** an authenticated user with 3 appointments across 2 stores
- **When** they visit `/perfil`
- **Then** the page SHALL display all 3 appointments with store name, date, status, and service

#### Scenario: Unauthenticated user is redirected to sign-in

- **Given** an unauthenticated user
- **When** they visit `/perfil`
- **Then** they SHALL be redirected to the sign-in page

---

### Requirement: Favorite stores page

The `/perfil/favoritos` page SHALL display the user's favorite stores with the ability to add or remove favorites.

#### Scenario: User views favorite stores

- **Given** an authenticated user with 2 favorite stores
- **When** they visit `/perfil/favoritos`
- **Then** the page SHALL display both stores with name, specialty, and rating

#### Scenario: User toggles a favorite

- **Given** an authenticated user viewing the favorites page
- **When** they click "remove" on a favorited store
- **Then** the store SHALL be removed from their favorites
- **And** the UI SHALL update without a full page reload

---

### Requirement: Review creation

`POST /api/reviews` SHALL create a review for a store.

Requirements:
- User MUST be authenticated
- User MUST have at least one `COMPLETED` appointment with the target store
- One review per user per store (enforced by `@@unique([storeId, userId])`)

#### Scenario: Authenticated user with completed appointment creates review

- **Given** an authenticated user with a COMPLETED appointment at store "mi-clinica"
- **When** they POST to `/api/reviews` with `{ storeId, rating: 5, comment: "Excellent" }`
- **Then** a review SHALL be created with status 201

#### Scenario: User without completed appointment cannot review

- **Given** an authenticated user with no COMPLETED appointments at a store
- **When** they POST to `/api/reviews` for that store
- **Then** the response SHALL be 403 Forbidden

#### Scenario: Unauthenticated user cannot create review

- **Given** an unauthenticated user
- **When** they POST to `/api/reviews`
- **Then** the response SHALL be 401 Unauthorized

---

### Requirement: Public stores API

`GET /api/stores/public` SHALL return all active stores with their average rating.

Query parameters:
- `?specialty=` — optional, case-insensitive partial match filter

Response SHALL include: id, name, slug, specialty, address, averageRating, reviewCount.

#### Scenario: List all public stores

- **Given** 5 stores exist in the database
- **When** a client calls `GET /api/stores/public`
- **Then** the response SHALL include all 5 stores with averageRating and reviewCount

#### Scenario: Filter by specialty

- **Given** stores with specialties "Dentistry" and "Psychology"
- **When** a client calls `GET /api/stores/public?specialty=psy`
- **Then** only stores matching "psy" (case-insensitive) SHALL be returned
