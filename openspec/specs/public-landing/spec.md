# Spec: public-landing

## ADDED Requirements

### Requirement: Store listing on landing page

The landing page (`/`) SHALL display a list of all active stores.

Each store card SHALL include:
- Store name
- Specialty
- Average rating (computed from reviews)

The landing page SHALL be a Server Component for SEO.

#### Scenario: Landing page renders all active stores

- **Given** there are 3 active stores in the database
- **When** a user visits `/`
- **Then** the page SHALL render 3 store cards
- **And** each card SHALL display name, specialty, and average rating

#### Scenario: Store with no reviews shows zero rating

- **Given** a store exists with no reviews
- **When** the landing page renders
- **Then** the store card SHALL display an average rating of 0

---

### Requirement: Filter stores by specialty

The landing page SHALL support filtering stores by specialty via the `?specialty=` URL search parameter.

The filter SHALL be case-insensitive and match partial specialty names.

#### Scenario: Filter by specialty query param

- **Given** there are stores with specialties "Dentistry", "Dermatology", and "Psychology"
- **When** a user visits `/?specialty=dent`
- **Then** only stores with specialty matching "dent" (case-insensitive) SHALL be displayed

#### Scenario: Empty specialty filter shows all stores

- **Given** there are multiple stores
- **When** a user visits `/` without a specialty param
- **Then** all active stores SHALL be displayed

---

### Requirement: Store card navigation

Each store card SHALL link to the store's public page at `/[slug]`.

#### Scenario: Clicking a store card navigates to store page

- **Given** a store with slug "mi-clinica" is displayed on the landing page
- **When** a user clicks the store card
- **Then** the browser SHALL navigate to `/mi-clinica`
