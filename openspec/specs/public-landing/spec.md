# Spec: public-landing

## MODIFIED Requirements

### Requirement: Store listing with text search

The landing page SHALL list stores with pagination (12 per page), filterable by `specialty` and by free-text `q` matching name, specialty, or address (case-insensitive).

#### Scenario: Landing filters by specialty

- **Given** stores with specialties "Peluquería" and "Veterinaria"
- **When** a user selects the "Veterinaria" filter
- **Then** only veterinary stores SHALL be listed

#### Scenario: Landing searches by free text

- **Given** a store named "Peluquería Central" at "Av. Siempre Viva 742"
- **When** a user searches for "central"
- **Then** the store SHALL appear in results

#### Scenario: Landing paginates results

- **Given** more than 12 stores
- **When** the landing loads the first page
- **Then** the response SHALL include `totalPages > 1` and pagination controls SHALL render

### Requirement: Store card data without ratings

Store cards SHALL display name, specialty, address, and slug. Since reviews are out of scope, `averageRating` SHALL be `0` and `reviewCount` SHALL be `0`.

### Requirement: Landing data from API

The landing SHALL fetch data from `GET /api/stores/public` (with `q`, `specialty`, `page`, `limit` query params) instead of querying the database directly.

#### Scenario: Landing reflects backend search

- **Given** the backend supports the `q` filter
- **When** the landing sends `?q=central`
- **Then** the results SHALL match the search
