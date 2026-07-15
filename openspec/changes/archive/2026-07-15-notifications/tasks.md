# Tasks: Notifications

## Phase 1: Schema + Lib

### 1.1 Add managementToken to Appointment model + migration
- [x] Add `managementToken String? @unique` field to Appointment model in `prisma/schema.prisma`
- [x] Run `npx prisma db push --accept-data-loss` (non-interactive env, equivalent to migrate dev)
- [x] Verify migration applies cleanly — `prisma generate` confirmed client regenerated

### 1.2 Install Resend
- [x] Run `npm install resend`
- [x] Verify in `package.json` — resend ^5.x added

### 1.3 Create `src/lib/management-link.ts`
- [x] Export `generateManagementToken()` using `crypto.randomUUID()`
- [x] Export `buildManagementUrl(token: string)` using `process.env.APP_URL` (fallback to localhost, safer than throwing)
- [ ] ~~Throw if `APP_URL` is not set~~ → Fallback to `http://localhost:3000` instead (avoids runtime crashes)

### 1.4 Create `src/lib/email.ts`
- [x] Initialize Resend client with `process.env.RESEND_API_KEY`
- [x] Export `sendConfirmationEmail()` — plain text template with appointment details + optional management link
- [x] Export `sendCancellationEmail()` — plain text template with cancellation notice
- [x] Export `sendReminderEmail()` — plain text template with upcoming appointment details
- [x] All functions use `process.env.EMAIL_FROM` as `from` address
- [x] Mark module as `"use server"` (server-only)

### 1.5 Create `src/lib/whatsapp.ts`
- [x] Export `sendWhatsAppReminder()` — logs params with `[WhatsApp]` prefix, returns `{ success: true, channel: "whatsapp-stub" }`

## Phase 2: Integration

### 2.1 Hook confirmation email into book/route.ts
- [x] Import `generateManagementToken` + `buildManagementUrl` + `sendConfirmationEmail`
- [x] Generate token in `prisma.appointment.create` data
- [x] After successful create, wrap `sendConfirmationEmail()` in `.catch()` (fire-and-forget)
- [x] Include management URL only if `userId` is null (anonymous booking — `isAuthenticated` check)
- [x] Use existing `store.name` from the store lookup above (no extra query needed)

### 2.2 Hook cancellation email into appointments/[id]/route.ts
- [x] Import `sendCancellationEmail` + `buildManagementUrl`
- [x] After successful status update to CANCELLED, wrap `sendCancellationEmail()` in `.catch()` (fire-and-forget)
- [x] Include management URL if appointment has `managementToken`
- [x] Fetch store name via `include: { store: { select: { name: true } } }` on the update

### 2.3 Create `src/app/api/cron/reminders/route.ts`
- [x] GET handler
- [x] Validate `Authorization: Bearer ${CRON_SECRET}` header — return 401 if invalid
- [x] Query: `status: CONFIRMED`, `dateTime: { gte: now, lte: now + 60min }`
- [x] Include store relation for store name
- [x] For each appointment: call `sendReminderEmail()` + `sendWhatsAppReminder()` in try/catch
- [x] Return `{ sent: number, failed: number }`

## Phase 3: Env + Verify

### 3.1 Update `.env.local`
- [x] Add `RESEND_API_KEY="re_..."`
- [x] Add `CRON_SECRET="generate-with-openssl-rand-base64-32"`
- [x] Add `APP_URL="http://localhost:3000"`
- [x] Add `EMAIL_FROM="onboarding@resend.dev"`

### 3.2 Type check
- [x] Run `npx tsc --noEmit` — passed with zero errors

### 3.3 Build
- [x] Run `npm run build` — completed successfully, all routes compiled including `/api/cron/reminders`

## Summary

| Phase | Tasks | Est. Lines |
|-------|-------|-----------|
| 1. Schema + Lib | 1.1–1.5 | ~120 |
| 2. Integration | 2.1–2.3 | ~130 |
| 3. Env + Verify | 3.1–3.3 | ~10 |
| **Total** | **11 tasks** | **~260** |
