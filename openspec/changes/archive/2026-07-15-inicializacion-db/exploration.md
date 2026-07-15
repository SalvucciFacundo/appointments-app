# Exploration: Inicialización del Proyecto y Base de Datos

## Current State
The project is pre-implementation — no `package.json`, no source code, only `openspec.md` and `tasks.md`. PostgreSQL 18.4 runs locally with an empty database. Node.js v24.16.0 and npm 11.4.2 are available.

## Affected Areas
- `package.json` — project dependencies
- `tsconfig.json` — TypeScript configuration
- `next.config.*` — Next.js configuration
- `prisma/schema.prisma` — database schema
- `prisma/prisma.config.ts` — Prisma v7 configuration
- `prisma/seed.ts` — seed data script
- `.env` / `.env.local` — environment variables

## Approaches

### Project Initialization

1. **Bootstrap via temp dir + merge** (Recommended)
   - Generate via create-next-app in a temp directory, merge to project root
   - Pros: Uses official template, correct defaults
   - Cons: Extra merge step

2. **Manual bootstrap**
   - npm init + install next/react/react-dom manually
   - Pros: Works in non-empty directory
   - Cons: More error-prone, no official template

### Migration Strategy

1. **Single migration with all 10 models** (Recommended)
   - All models including CalendarSync in the first migration
   - Pros: Complete schema from day 1, all relationships present
   - Cons: Larger initial migration (but it's a one-time cost)

2. **Split migrations**
   - Core models first, integration models later
   - Cons: Would break Store-CalendarSync relationship

## Schema Corrections Needed
- **Add `VerificationToken` model** — Auth.js v5 PrismaAdapter requires it
- **Use `prisma.config.ts`** — Prisma v7 format for seed configuration

## Recommended Stack
- Next.js 15+ (App Router)
- Prisma v7 with PostgreSQL
- Auth.js v5 with PrismaAdapter + Google Provider
- tsx for running seed scripts

## Ready for Proposal
Yes.
