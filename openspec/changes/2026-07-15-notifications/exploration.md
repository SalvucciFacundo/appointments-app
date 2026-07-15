## Exploration: notifications

### Current State

The application today handles appointments end-to-end but has **zero notification infrastructure**:

- **Booking endpoint** (`app/api/stores/[storeId]/book/route.ts`): Creates appointments in the DB and returns JSON. No email is sent after creation.
- **Status transition route** (`app/api/stores/[storeId]/appointments/[id]/route.ts`): Owner can CONFIRM/REJECT/COMPLETE via PUT with action. No email sent on cancellation or confirmation.
- **Appointment model** (`prisma/schema.prisma`): Has `id` (cuid), `clientEmail`, `userId`, `status` — but **no field for an anonymous management token**.
- **Auth system**: Auth.js v5 with Google, JWT role injection. Booking sets status `PENDING` if anonymous, `CONFIRMED` if authenticated.
- **wa.me link**: Already built in the PendingQueue component — free WhatsApp deep-link for the owner to contact anonymous clients manually.
- **Dependencies**: `resend` is **not installed**. No `RESEND_API_KEY` in `.env.local`.
- **Existing lib pattern**: Thin server utilities under `src/lib/` (e.g., `prisma.ts`, `api-helpers.ts`, `slots.ts`).

### Affected Areas

- `src/lib/email.ts` — **NEW**: Server-only module, Resend client + email template functions
- `prisma/schema.prisma` — Add `managementToken` field to Appointment model
- `src/app/api/stores/[storeId]/book/route.ts` — Inject email hook after successful creation
- `src/app/api/stores/[storeId]/appointments/[id]/route.ts` — Inject email hook on cancellation
- `src/app/api/cron/reminders/route.ts` — **NEW**: Protected cron endpoint for upcoming reminders
- `.env.local` — Add `RESEND_API_KEY`
- `package.json` — Add `resend` dependency
- `src/lib/management-link.ts` — **NEW**: Token generation and management link builder utility

### Approaches

#### 1. Management Token — Field on Appointment model vs. Separate Token model

**Option A: Field on Appointment** (`managementToken String? @unique`)
- Pros: Simple, single query to look up, no extra migration/table, natural cascading (delete appointment → delete token), fits MVP
- Cons: Token lives on the same row as the appointment data
- Effort: Low

**Option B: Separate `ManagementToken` model** (one-to-many: one appointment could have multiple tokens)
- Pros: Cleaner separation, supports rotating tokens, audit trail
- Cons: Over-engineered for MVP — we only need one token per appointment for cancel/reschedule
- Effort: Medium

**Recommendation**: **Option A** — `managementToken String? @unique` on Appointment. Generate with `crypto.randomUUID()`. Simpler, direct, easy to revoke (clear the field). Can extract to a separate model later if rotation/tracking becomes necessary.

#### 2. Email Service Architecture

**Option A: Single `src/lib/email.ts` with inline templates**
- Simple string templates for confirmation, reminder, cancellation emails
- Each function takes typed args + the management link (for anonymous management)
- Effort: Low

**Option B: React Email + Resend**
- Use `@react-email/components` for rich HTML email templates
- More visually polished, but adds a dependency and build complexity
- Overkill for MVP transactional emails
- Effort: Medium

**Recommendation**: **Option A** for MVP. Resend supports React Email out of the box, but plain HTML strings are sufficient for transactional emails. Can upgrade to React Email later.

File structure:
```
src/lib/email.ts
  └─ sendConfirmationEmail(to: string, appointment, managementLink: string)
  └─ sendReminderEmail(to: string, appointment, managementLink: string)
  └─ sendCancellationEmail(to: string, appointment)
```

#### 3. WhatsApp Meta Cloud API

**Option A: Implement now with mock/skip**
- Create a `src/lib/whatsapp.ts` service with a `sendWhatsAppReminder()` function
- For MVP, log instead of actually sending (no WABA, no approved template)
- The cron endpoint calls it, catches errors, falls back to email
- Effort: Low (scaffold the service), High (actual Meta integration)

**Option B: Defer entirely — email-only MVP**
- Skip the WhatsApp service entirely for now
- The cron endpoint only sends email reminders
- WhatsApp becomes a future enhancement
- Effort: None now

**Recommendation**: **Option A** — scaffold the service with a graceful no-op/mock for now. The openspec clearly defines WhatsApp reminders as part of the system, and the cron design should account for the WhatsApp → email fallback chain. Marking the stub as `needs-waba` makes the gap explicit.

#### 4. Cron Reminder Endpoint

**Option A: Vercel Cron Jobs** — `/api/cron/reminders` with `CRON_SECRET` Bearer token
- Standard Next.js Route Handler, protected by `CRON_SECRET` env var
- Vercel Cron configuration in `vercel.json` or `next.config.ts`
- Finds upcoming CONFIRMED appointments within the next hour, sends reminders
- Effort: Low

**Option B: External cron service (e.g., cron-job.org, EasyCron)**
- Same endpoint idea but triggered externally
- More flexible scheduling but adds external dependency
- Effort: Low

**Recommendation**: **Option A**. The endpoint is architecture-agnostic — works with Vercel Cron, external cron, or even a manual trigger. Protection via shared secret header is simple and effective.

### Recommendation Summary

| Component | Choice | Why |
|---|---|---|
| Management Token | `managementToken` field on Appointment | Simplest, single query, follows existing schema pattern |
| Email Service | `src/lib/email.ts` with plain templates | Low dependency, transactional emails don't need rich HTML |
| WhatsApp | Scaffold stub in `src/lib/whatsapp.ts` | Defers Meta integration but keeps the architecture ready |
| Cron Endpoint | `api/cron/reminders` with `CRON_SECRET` | Works with any cron provider, standard Next.js pattern |
| Resend Package | Add `resend` to dependencies | Official Node SDK, server-only import pattern |

### Sequence: Booking → Confirmation Email

```
Client                     API: book/route.ts              Prisma          Resend
  │                              │                           │               │
  │── POST /book (body) ──────→  │                           │               │
  │                              │── validate & check slot ─→│               │
  │                              │←── slot available ────────│               │
  │                              │                           │               │
  │                              │── create appointment ───→│               │
  │                              │   (with managementToken)  │               │
  │                              │←── appointment ──────────│               │
  │                              │                           │               │
  │                              │── sendConfirmationEmail ──────────────→  │
  │                              │   (appointment, mgmtLink)  │               │
  │                              │←── ok ─────────────────────────────────  │
  │                              │                           │               │
  │←── 201 { appointment } ────│                           │               │
```

### Risks

1. **Resend deliverability**: Free tier (100 emails/day) may hit limits in production. Emails to invalid addresses will bounce — need error handling that doesn't fail the booking.
2. **Management token security**: The token in the URL is the only thing protecting anonymous appointments from unauthorized cancellation. If the email is intercepted, anyone with the link can cancel. This is an accepted tradeoff (same as every "magic link" system), but should be documented.
3. **WhatsApp dependency**: Meta Business verification and template approval can take weeks. The email fallback is essential.
4. **Timezone edge case**: The cron job runs in UTC. Finding appointments "1 hour from now" across different store timezones requires converting the search window correctly. An appointment at 9AM in `America/Argentina/Buenos_Aires` (UTC-3) should be found when the cron runs at 8AM UTC — this is handled correctly if you compare against UTC timestamps.
5. **Next.js 16.2.10**: Must verify Route Handler patterns — specifically `params` being a Promise (already confirmed in existing routes).

### Ready for Proposal

Yes. The codebase patterns, schema, and notification strategy from openspec.md provide clear guidance. The exploration identifies:
- Schema change needed (1 field on Appointment)
- 2 new lib files (email, management-link)
- 1 new cron route
- 2 modified existing routes (book, status change)
- WhatsApp service scaffold

The proposal phase should detail the exact email templates, the cron schedule configuration, and the WhatsApp fallback strategy.
