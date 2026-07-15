# Project Foundation Specification

## Purpose

Define the foundational requirements for bootstrapping the Appointments-app from a pre-implementation state into a runnable Next.js project with a complete PostgreSQL schema, seed data, and environment configuration. No existing behavior exists — this is a greenfield spec.

## Requirements

### Requirement: Project Scaffold

The system MUST provide a Next.js 15+ project using the App Router with TypeScript, installable via `npm install` and runnable via `npm run dev` on `localhost:3000`.

#### Scenario: Dev server starts successfully

- GIVEN a fresh clone of the repository
- WHEN `npm install` and `npm run dev` are executed
- THEN the development server MUST start on `localhost:3000` without errors
- AND the default Next.js landing page MUST be accessible

#### Scenario: TypeScript compilation succeeds

- GIVEN the project scaffold is in place
- WHEN `npx tsc --noEmit` is executed
- THEN zero TypeScript errors MUST be reported

### Requirement: Database Schema

The system MUST define a Prisma v7 schema in `prisma/schema.prisma` containing exactly 11 models and 2 enums, with all relations, indexes, and constraints matching the openspec data model.

Models: User, Store, Appointment, Review, BusinessHour, BlockedDate, CalendarSync, Account, Session, VerificationToken.
Enums: Role (USER, OWNER, ADMIN), AppointmentStatus (PENDING, CONFIRMED, CANCELLED, COMPLETED).

#### Scenario: Schema validates

- GIVEN the schema file is written
- WHEN `npx prisma validate` is executed
- THEN validation MUST pass with no errors

#### Scenario: All required models exist

- GIVEN the Prisma schema
- WHEN the schema is parsed
- THEN all 11 models and 2 enums MUST be present
- AND the VerificationToken model MUST include identifier, token, expires fields with a unique constraint on (identifier, token)

#### Scenario: Relations and indexes are correct

- GIVEN the Prisma schema
- WHEN relations are inspected
- THEN Store.ownerId MUST be unique with cascade delete
- AND Appointment MUST have a compound index on (storeId, dateTime)
- AND Review MUST have a unique constraint on (storeId, userId)

### Requirement: Initial Migration

The system MUST produce a single initial migration that creates all 11 tables with correct columns, relations, indexes, and constraints.

#### Scenario: Migration applies cleanly

- GIVEN an empty PostgreSQL database
- WHEN `npx prisma migrate dev --name init` is executed
- THEN all 11 tables MUST be created
- AND the migration MUST complete without errors

#### Scenario: Migration is idempotent on fresh database

- GIVEN the migration has been applied once
- WHEN `npx prisma migrate status` is executed
- THEN the database MUST be reported as up to date

### Requirement: Seed Data

The system MUST provide an idempotent seed script at `prisma/seed.ts` that populates the database with test data using upserts.

Seed data MUST include: 1 admin user, 2 owner users each with a store, business hours (Mon-Sat 09:00-18:00), and sample appointments.

#### Scenario: Seed populates test data

- GIVEN a migrated but empty database
- WHEN `npx prisma db seed` is executed
- THEN the database MUST contain at least 1 admin, 2 owners, 2 stores, business hours, and appointments

#### Scenario: Seed is idempotent

- GIVEN the seed has already run once
- WHEN `npx prisma db seed` is executed again
- THEN the same records MUST exist with no duplicates and no errors

### Requirement: Environment Configuration

The system MUST provide `.env` and `.env.local` files with all required environment variable placeholders.

Required variables: DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.

#### Scenario: Environment files exist

- GIVEN the project scaffold is complete
- WHEN the project root is inspected
- THEN `.env` MUST contain DATABASE_URL with a PostgreSQL connection string
- AND `.env.local` MUST contain AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET placeholders
