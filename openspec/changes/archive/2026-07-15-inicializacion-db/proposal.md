# Proposal: inicializacion-db

## Intent

Bootstrap the Appointments-app from a pre-implementation state (no `package.json`, no source code) into a runnable Next.js project with a complete PostgreSQL schema, seed data, and a working dev server. This is the foundational change — nothing else can proceed until it lands.

## Scope

### In Scope
- Next.js 15+ project via `create-next-app` (temp dir + merge strategy)
- Prisma v7 setup with `prisma.config.ts` and PostgreSQL provider
- Complete schema: 11 models (10 from openspec.md + `VerificationToken` for Auth.js v5 PrismaAdapter)
- Single initial migration covering the full schema
- Seed script: 1 admin, 2 owners with stores, business hours, test appointments
- Environment variable scaffolding (`.env`, `.env.local`)

### Out of Scope
- Auth.js adapter wiring (next change)
- API routes, pages, or middleware
- Notification integrations (Resend, WhatsApp, Google Calendar)
- Test runner setup

## Capabilities

### New Capabilities
- `project-foundation`: Next.js project scaffold, Prisma schema with all 11 models, initial migration, seed script, and environment configuration

### Modified Capabilities
None

## Approach

1. **Project scaffold** — Run `create-next-app` in a temp directory (`%TEMP%\appointments-scaffold`), then merge output into the project root excluding `node_modules/` and `.next/`. This avoids the non-empty directory error while preserving existing `openspec/` files.
2. **Prisma init** — `prisma init` with PostgreSQL provider, then configure `prisma.config.ts` (Prisma v7 format) with seed command pointing to `prisma/seed.ts` via `tsx`.
3. **Schema** — Write all 11 models in `prisma/schema.prisma`. Add the missing `VerificationToken` model required by Auth.js v5 PrismaAdapter (identifier, token, expires, unique constraint on identifier+token).
4. **Migration** — Single `prisma migrate dev --name init` to create all tables at once.
5. **Seed** — `prisma/seed.ts` using PrismaClient: upsert admin user, 2 owners each with a store, business hours (Mon-Sat 09:00-18:00), and 3 sample appointments per store.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | New | Project dependencies (next, react, prisma, @prisma/client, tsx, typescript) |
| `prisma/schema.prisma` | New | 11 models, 2 enums, relations, indexes |
| `prisma/prisma.config.ts` | New | Prisma v7 config with seed settings |
| `prisma/seed.ts` | New | Seed script with sample data |
| `prisma/migrations/` | New | Initial migration directory |
| `.env` / `.env.local` | New | DATABASE_URL, AUTH_SECRET, GOOGLE_* placeholders |
| `tsconfig.json` | New | TypeScript configuration from create-next-app |
| `next.config.ts` | New | Next.js configuration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Temp dir merge overwrites existing openspec files | Low | Explicitly exclude `openspec/` from merge; verify before copy |
| Prisma v7 config format incompatibility | Low | Use `prisma.config.ts` (not legacy); pin `@prisma/client` to v7 |
| Seed fails on re-run (duplicate data) | Med | Use `upsert` instead of `create` for all seed records |
| PowerShell blocks npm lifecycle scripts | Med | Use `cmd /c npm` for prisma commands if needed |

## Rollback Plan

Pre-implementation state — no production data at risk. Rollback is git-level:
1. Delete generated files: `package.json`, `node_modules/`, `prisma/`, `.env*`, `next.config.ts`, `tsconfig.json`, `app/`, `public/`
2. Drop the database tables: `prisma migrate reset --force` or `DROP SCHEMA public CASCADE`
3. `git checkout .` to restore clean state
4. The `openspec/` directory is never touched by this change

## Dependencies

- PostgreSQL 18.4 running locally on port 5432 (confirmed available)
- Node.js v24.16.0 + npm 11.4.2 (confirmed available)

## Success Criteria

- [ ] `npx create-next-app` output merged into project root without conflicts
- [ ] `npx prisma migrate dev --name init` completes — all 11 tables created
- [ ] `npx prisma db seed` completes — admin, 2 owners, 2 stores, business hours, and test appointments exist
- [ ] `npm run dev` starts without errors on `localhost:3000`
- [ ] `npx prisma studio` opens and shows seeded data
