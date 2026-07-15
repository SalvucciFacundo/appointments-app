# Tasks: inicializacion-db

> **Status**: ready-for-apply | **Dependencies**: PostgreSQL 18.4 running on localhost:5432, Node.js v24.16.0 + npm 11.4.2

## Review Workload Forecast

- **Generated files** (create-next-app): `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*`, `public/*`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`
- **Hand-written files**: `prisma/schema.prisma` (~150 lines), `prisma/seed.ts` (~120 lines), `prisma/prisma.config.ts` (~12 lines), `.env` (1 line), `.env.local` (3 lines)
- **Generated artifacts**: `prisma/migrations/*` (~100 lines)
- **Estimated total changed lines**: ~200-300 (most from create-next-app)
- **400-line budget risk**: Low
- **PR strategy**: Single PR

---

## Task List

### Task 1: Scaffold Next.js project skeleton
- [x] Run `npx create-next-app@latest %TEMP%\appointments-scaffold --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --turbopack --yes`
- Merge output into project root via `robocopy` with `/XD node_modules .next .git openspec .config .atl /XF openspec.md tasks.md`
- Run `npm install` at project root
- **Creates**: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/`, `public/`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`

### Task 2: Write environment configuration files
- [x] `.env`: `DATABASE_URL="postgresql://postgres:facundo1288@localhost:5432/appointments_db"`
- `.env.local`: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` placeholders
- Append `.env.local` and `.env*.local` to `.gitignore`
- **Creates**: `.env`, `.env.local`

### Task 3: Write Prisma configuration and complete schema
- [x] `prisma/prisma.config.ts`: `defineConfig` with `earlyAccess: true`, schema path, and `seed: "npx tsx ..."`
- `prisma/schema.prisma`: 11 models (User, Store, Appointment, Review, BusinessHour, BlockedDate, CalendarSync, Account, Session, VerificationToken) + 2 enums (Role, AppointmentStatus)
- Key constraints: `Store.ownerId @unique onDelete Cascade`, `Appointment @@index([storeId, dateTime])`, `Review @@unique([storeId, userId])`
- **Creates**: `prisma/prisma.config.ts`, `prisma/schema.prisma`

### Task 4: Generate initial database migration
- [x] Run `npx prisma migrate dev --name init`
- [x] Verify all 11 tables created with `npx prisma migrate status` (must report "up to date")
- **Creates**: `prisma/migrations/*`

### Task 5: Write idempotent seed script
- [x] `prisma/seed.ts` using `PrismaClient` with `upsert` everywhere (safe to re-run)
- Seed data contract: 1 admin (`admin@appointments.app`), 2 owners (`owner1@test.com`, `owner2@test.com`), 2 stores (`peluqueria-central`, `veterinaria-norte`), 12 business hours (Mon-Sat 09:00-18:00 × 2 stores), 6 sample appointments (3 per store, next 7 days)
- **Creates**: `prisma/seed.ts`

### Task 6: Execute seed and full verification
- [x] Run `npx prisma db seed` (first run)
- [x] Re-run `npx prisma db seed` (verify idempotency — no errors, no duplicates)
- [x] Run `npx prisma validate` (schema validation)
- [x] Start `npm run dev` and confirm `localhost:3000` serves without errors
- [x] Open `npx prisma studio` to visually confirm seeded data
- **Validates**: all 5 success criteria from proposal

---

## Execution Order

```
T1 (scaffold) → T2 (env) → T3 (prisma config + schema) → T4 (migration) → T5 (seed script) → T6 (seed + verify)
```

All tasks are sequential: each depends on the previous.
