# Spec: notifications

## Requirements

### REQ-1: Management Token on Appointment

The Appointment model MUST include a `managementToken String? @unique` field. The token MUST be generated at appointment creation time using `crypto.randomUUID()`. Existing appointments are unaffected (field is nullable).

**Acceptance Criteria:**
- Migration `add-management-token` applies cleanly
- New appointments have a non-null `managementToken`
- Token is unique across all appointments

### REQ-2: Booking Confirmation Email

After a successful appointment creation in `POST /api/stores/[storeId]/book`, a confirmation email MUST be sent to `clientEmail`. The email send MUST be non-blocking — failures are logged but MUST NOT cause the booking response to fail.

**Acceptance Criteria:**
- Confirmation email sent to client after create
- Booking returns 201 even if email send throws
- Email contains appointment details (date, time, store name, service)

### REQ-3: Cancellation Email

When an appointment status transitions to `CANCELLED` via `PUT /api/stores/[storeId]/appointments/[id]`, a cancellation email MUST be sent to `clientEmail`. Non-blocking — same error strategy as REQ-2.

**Acceptance Criteria:**
- Cancellation email sent on status change to CANCELLED
- API response is not affected by email failure
- Email contains appointment details and cancellation notice

### REQ-4: Management Link in Emails

Emails for appointments without an authenticated user (anonymous bookings) MUST include a management link in the format `/manage/[token]`. The link allows the client to view and manage their appointment.

**Acceptance Criteria:**
- Management URL built from `APP_URL` env var + `/manage/` + token
- Link included in confirmation and cancellation emails
- URL is clickable in plain-text email format

### REQ-5: Cron Reminder Endpoint

`GET /api/cron/reminders` MUST find all `CONFIRMED` appointments with `dateTime` within the next 60 minutes and send a reminder email to each client. The endpoint MUST validate a `CRON_SECRET` Bearer token in the `Authorization` header.

**Acceptance Criteria:**
- Returns 401 if Authorization header is missing or invalid
- Queries appointments where `status = CONFIRMED` AND `dateTime` is between now and now + 60 minutes
- Sends reminder email to each matching appointment's `clientEmail`
- Returns 200 with count of reminders sent
- Individual email failures are logged but do not prevent other reminders

### REQ-6: WhatsApp Stub

`src/lib/whatsapp.ts` MUST export a `sendWhatsAppReminder()` function that logs the call parameters and returns without sending. This is a no-op placeholder until WABA (WhatsApp Business API) setup is complete.

**Acceptance Criteria:**
- Function exists and is callable
- Logs appointment details via `console.log` with `[WhatsApp]` prefix
- Returns `{ success: true, channel: "whatsapp-stub" }`
- Cron endpoint calls WhatsApp stub alongside email (email is primary)
