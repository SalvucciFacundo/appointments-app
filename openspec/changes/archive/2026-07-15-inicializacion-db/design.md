# Design: inicializacion-db

## Executive Summary

Bootstrap a pre-implementation directory into a runnable Next.js 15+ project with a complete Prisma v7 schema (11 models, 2 enums), a single initial migration, an idempotent seed script, and environment scaffolding. The `openspec/` directory is never touched.

---

## Decision 1: Scaffold Strategy — Temp Dir + Merge

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Temp dir + merge** | Official template, correct defaults, future-proof | Extra copy step | **Selected** |
| Manual `npm init` + install | Works in non-empty dir | Error-prone, no template, missing configs | Rejected |

**Execution plan:**

1. `npx create-next-app@latest %TEMP%\appointments-scaffold --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --turbopack --yes`
2. Merge output into project root using `robocopy` (Windows) with `/XD node_modules .next .git openspec .config .atl /XF openspec.md tasks.md`
3. Verify: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/`, `public/` present at root
4. `npm install` at project root

**Why robocopy over xcopy:** `/XD` (exclude dirs) and `/XF` (exclude files) prevent clobbering `openspec/`, `.config/`, `.atl/`, and root markdown files. The merge is a one-way copy — existing files in the project root that aren't in the scaffold (like `openspec.md`) are untouched.

---

## Decision 2: Schema Organization — Single File

All 11 models and 2 enums in one `prisma/schema.prisma` file. No splitting.

**Rationale:** At 11 models the schema is ~150 lines — well within readable range. Splitting into multiple files via Prisma v7's multi-file support adds import complexity with no architectural benefit at this scale. Revisit at ~25+ models.

**Models (11):** User, Store, Appointment, Review, BusinessHour, BlockedDate, CalendarSync, Account, Session, VerificationToken (+ the 10 from openspec.md).

**VerificationToken** (missing from openspec.md, required by Auth.js v5 PrismaAdapter):

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Key constraints preserved from openspec.md:**
- `Store.ownerId` — `@unique`, `onDelete: Cascade`
- `Appointment` — `@@index([storeId, dateTime])`
- `Review` — `@@unique([storeId, userId])`

---

## Decision 3: Migration Strategy — Single Initial Migration

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Single `init` migration** | All relations present day 1, clean rollback | Larger one-time migration | **Selected** |
| Split migrations | Smaller chunks | Breaks Store↔CalendarSync relation, ordering complexity | Rejected |

**Command:** `npx prisma migrate dev --name init`

This creates all 11 tables atomically. Since this is a greenfield project with no production data, there is no reason to stage the migration.

---

## Decision 4: Seed Architecture — Upsert-Based Idempotency

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **`upsert` with `where`** | Safe to re-run, no duplicates | Slightly more verbose | **Selected** |
| `create` | Simpler code | Fails on re-run, requires `deleteMany` first | Rejected |
| `createMany` + ignore | Fast | Doesn't update existing records | Rejected |

**Seed data contract:**

| Entity | Count | Key fields for upsert |
|--------|-------|-----------------------|
| Admin user | 1 | `email: "admin@appointments.app"` |
| Owner users | 2 | `email: "owner1@test.com"`, `email: "owner2@test.com"` |
| Stores | 2 | `slug: "peluqueria-central"`, `slug: "veterinaria-norte"` |
| Business hours | 12 | 6 days × 2 stores (Mon-Sat 09:00-18:00) |
| Appointments | 6 | 3 per store, spread across next 7 days |

**Runner:** `tsx` via `prisma.config.ts` seed configuration.

---

## Decision 5: Seed Runner — `tsx` over `ts-node`

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **`tsx`** | Zero config, ESM-native, fast | Smaller ecosystem | **Selected** |
| `ts-node` | Mature | Requires `tsconfig.json` flags for ESM, slower | Rejected |

**Configuration in `prisma/prisma.config.ts`:**

```typescript
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "schema.prisma"),
  seed: `npx tsx ${path.join(__dirname, "seed.ts")}`,
});
```

---

## Decision 6: Environment Configuration

**`.env`** (committed-safe defaults):

```env
DATABASE_URL="postgresql://postgres:facundo1288@localhost:5432/appointments_db"
```

**`.env.local`** (secrets — gitignored):

```env
AUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**`.gitignore`** additions: `.env.local`, `.env*.local`

---

## File Manifest

| File | Source | Description |
|------|--------|-------------|
| `package.json` | create-next-app + `prisma`, `@prisma/client`, `tsx` | Dependencies |
| `tsconfig.json` | create-next-app | TypeScript config |
| `next.config.ts` | create-next-app | Next.js config |
| `src/app/` | create-next-app | App Router skeleton |
| `public/` | create-next-app | Static assets |
| `prisma/schema.prisma` | Hand-written | 11 models, 2 enums |
| `prisma/prisma.config.ts` | Hand-written | Prisma v7 config with seed |
| `prisma/seed.ts` | Hand-written | Idempotent seed script |
| `prisma/migrations/` | Generated | `init` migration |
| `.env` | Hand-written | DATABASE_URL |
| `.env.local` | Hand-written | Auth + Google placeholders |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `robocopy` merge clobbers `openspec/` | Low | Explicit `/XD openspec` exclusion + verify file list before and after |
| Prisma v7 `defineConfig` API change | Low | Pin `prisma` and `@prisma/client` to same v7 minor |
| Seed `upsert` race on `BusinessHour` | Low | BusinessHours use composite `where` (`storeId` + `dayOfWeek`) |
| PowerShell npm lifecycle script block | Med | Use `cmd /c npx prisma ...` as fallback |
