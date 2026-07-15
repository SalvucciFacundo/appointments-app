# Proposal: Notifications

## Intent

The system books appointments but sends zero notifications. Clients receive no confirmation, no reminders, no cancellation notice. This creates no-shows, confusion, and a poor user experience. This change adds email notifications (via Resend) at key lifecycle points and scaffolds WhatsApp infrastructure for future activation.

## Scope

### In Scope
- Migration: add `managementToken String? @unique` to Appointment model
- Email service (`src/lib/email.ts`) — confirmation, reminder, cancellation (plain text)
- Management link utility (`src/lib/management-link.ts`) — token generation + URL builder
- WhatsApp stub (`src/lib/whatsapp.ts`) — no-op until WABA setup
- Email hooks in booking route (`book/route.ts`) and cancellation route (`appointments/[id]/route.ts`)
- Cron endpoint `/api/cron/reminders` protected by `CRON_SECRET` Bearer token
- Install `resend` package

### Out of Scope
- Actual WhatsApp Meta Cloud API integration (requires WABA approval)
- Rich HTML email templates (React Email) — plain text for MVP
- SMS notifications
- Owner notification emails

## Capabilities

### New Capabilities
- `notifications`: Email sending infrastructure (Resend), management token lifecycle, cron-driven reminders, WhatsApp stub. Covers all notification channels and their orchestration.

### Modified Capabilities
- `store-booking`: Booking endpoint now generates a management token and triggers a confirmation email after successful appointment creation. Email failure MUST NOT fail the booking response.
- `owner-appointments`: Cancellation action now triggers a cancellation email to the client. Management link included for anonymous appointments.

## Approach

1. **Schema**: Single `managementToken` field on Appointment (Option A from exploration). Generated via `crypto.randomUUID()` at creation time.
2. **Email**: `src/lib/email.ts` — server-only module wrapping Resend SDK. Three functions: `sendConfirmationEmail`, `sendReminderEmail`, `sendCancellationEmail`. All accept appointment data + management link.
3. **Management link**: `src/lib/management-link.ts` — builds `/manage/[token]` URLs for anonymous client self-service (cancel/reschedule).
4. **WhatsApp**: `src/lib/whatsapp.ts` — exports `sendWhatsAppReminder()` that logs and returns. Marked `needs-waba`. Cron calls it with email fallback.
5. **Cron**: `/api/cron/reminders` — queries CONFIRMED appointments within next hour window, sends reminders. Protected by `CRON_SECRET` header check.
6. **Error strategy**: Email/WhatsApp failures are caught and logged but never block the booking/cancellation response.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add `managementToken` field to Appointment |
| `src/lib/email.ts` | New | Resend email service with 3 template functions |
| `src/lib/management-link.ts` | New | Token generation + management URL builder |
| `src/lib/whatsapp.ts` | New | WhatsApp no-op stub |
| `src/app/api/stores/[storeId]/book/route.ts` | Modified | Add confirmation email hook + token generation |
| `src/app/api/stores/[storeId]/appointments/[id]/route.ts` | Modified | Add cancellation email hook |
| `src/app/api/cron/reminders/route.ts` | New | Cron endpoint for upcoming appointment reminders |
| `package.json` | Modified | Add `resend` dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Resend free tier limit (100 emails/day) | Low | Acceptable for MVP; monitor usage, upgrade plan if needed |
| Management token interception (magic link risk) | Low | Accepted tradeoff — same as standard magic link auth. Token is single-use per action |
| Email delivery failure blocks booking | Medium | Wrap all email calls in try/catch — never propagate errors to the response |
| Cron timezone mismatch | Medium | Compare UTC timestamps against appointment datetime; store timezone is already persisted |
| WhatsApp WABA approval delay | High | Stub pattern keeps architecture ready; email is the primary channel |

## Rollback Plan

1. Remove email hooks from booking and cancellation routes (revert to current behavior).
2. Drop `managementToken` column via reverse migration.
3. Remove cron endpoint and lib files.
4. No data loss — existing appointments unaffected (field is nullable).

## Dependencies

- `resend` npm package
- `RESEND_API_KEY` environment variable
- `CRON_SECRET` environment variable

## Success Criteria

- [ ] Booking an appointment sends a confirmation email to the client
- [ ] Cancelling an appointment sends a cancellation email to the client
- [ ] Cron endpoint sends reminder emails for upcoming confirmed appointments
- [ ] Email failures do not cause booking or cancellation requests to fail
- [ ] Management link in emails allows anonymous clients to access their appointment
- [ ] WhatsApp stub logs calls without errors
