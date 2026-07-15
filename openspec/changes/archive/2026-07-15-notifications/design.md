# Design: Notifications

## Technical Approach

Add email notification infrastructure using Resend SDK. Three notification types (confirmation, cancellation, reminder) triggered at appointment lifecycle points. Management tokens enable anonymous client self-service. WhatsApp channel scaffolded as a no-op stub. All email sends are fire-and-forget — failures logged, never propagated.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Email provider | Resend | SendGrid, AWS SES | Resend has simpler API, free tier (100/day) sufficient for MVP, native Next.js compatibility |
| Token generation | `crypto.randomUUID()` | nanoid, cuid | Built-in, no dependency, cryptographically random, sufficient uniqueness for management links |
| Token storage | Field on Appointment model | Separate token table | Single field is simpler, 1:1 relationship, nullable for existing data |
| Email format | Plain text | React Email (HTML) | MVP scope — plain text is faster to implement, avoids template rendering complexity |
| Error strategy | Try/catch + console.error | Bull queue, retry logic | MVP scope — no job queue infrastructure yet. Log and move on. |
| Cron protection | Bearer token (CRON_SECRET) | Vercel Cron auto-auth | Portable — works on any deployment target, not Vercel-locked |
| WhatsApp | Stub with console.log | Full Meta Cloud API | WABA approval required — stub keeps architecture ready without blocking |

## Data Flow

```
BOOKING FLOW:
  POST /book → prisma.create (with managementToken)
       ↓
  Response.json(201) ← fire-and-forget → sendConfirmationEmail()
                                              ↓
                                          Resend API

CANCELLATION FLOW:
  PUT /appointments/[id] → prisma.update(status: CANCELLED)
       ↓
  Response.json(200) ← fire-and-forget → sendCancellationEmail()
                                              ↓
                                          Resend API

CRON REMINDER FLOW:
  GET /cron/reminders (Authorization: Bearer CRON_SECRET)
       ↓
  prisma.findMany(status: CONFIRMED, dateTime: [now, now+60min])
       ↓
  For each appointment:
    → sendReminderEmail()        (primary, Resend)
    → sendWhatsAppReminder()     (stub, console.log)
       ↓
  Response.json({ sent: N })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `managementToken String? @unique` to Appointment |
| `src/lib/management-link.ts` | Create | `generateToken()` + `buildManagementUrl(token)` |
| `src/lib/email.ts` | Create | Resend client + `sendConfirmation()`, `sendCancellation()`, `sendReminder()` |
| `src/lib/whatsapp.ts` | Create | No-op `sendWhatsAppReminder()` stub |
| `src/app/api/stores/[storeId]/book/route.ts` | Modify | Generate token on create, fire confirmation email |
| `src/app/api/stores/[storeId]/appointments/[id]/route.ts` | Modify | Fire cancellation email on CANCELLED transition |
| `src/app/api/cron/reminders/route.ts` | Create | Cron endpoint: auth check, query, send reminders |
| `.env.local` | Modify | Add `RESEND_API_KEY`, `CRON_SECRET`, `APP_URL`, `EMAIL_FROM` |

## Interfaces / Contracts

```typescript
// src/lib/management-link.ts
export function generateToken(): string        // crypto.randomUUID()
export function buildManagementUrl(token: string): string  // `${APP_URL}/manage/${token}`

// src/lib/email.ts
export async function sendConfirmationEmail(params: {
  to: string; clientName: string; storeName: string;
  dateTime: Date; service?: string | null; managementUrl?: string;
}): Promise<void>

export async function sendCancellationEmail(params: {
  to: string; clientName: string; storeName: string;
  dateTime: Date; service?: string | null; managementUrl?: string;
}): Promise<void>

export async function sendReminderEmail(params: {
  to: string; clientName: string; storeName: string;
  dateTime: Date; service?: string | null;
}): Promise<void>

// src/lib/whatsapp.ts
export async function sendWhatsAppReminder(params: {
  phone: string; clientName: string; storeName: string;
  dateTime: Date; service?: string | null;
}): Promise<{ success: boolean; channel: string }>
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `management-link.ts` functions | Verify token format, URL construction |
| Unit | Email template functions | Mock Resend, verify correct params passed |
| Integration | Book route with email hook | Verify 201 returned even when email throws |
| Integration | Cron endpoint auth | Verify 401 without valid CRON_SECRET |
| Build | `tsc --noEmit` + `next build` | Type safety + build verification |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

1. Run `prisma migrate dev --name add-management-token`
2. Existing appointments get `managementToken = NULL` (acceptable — nullable field)
3. Deploy lib files + route modifications
4. Add env vars to deployment target
5. Set up cron job (Vercel Cron or external) hitting `/api/cron/reminders` every 15-30 min
6. No feature flag needed — email failures are non-blocking by design

## Open Questions

- [ ] Should reminder cron run every 15 or 30 minutes? (Recommendation: 15 min for tighter window)
- [ ] Should `managementToken` be generated for authenticated users too? (Recommendation: yes — consistent behavior, token is unused for authenticated users but costs nothing)
