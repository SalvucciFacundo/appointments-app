# Appointments App — SaaS Booking Platform

A multitenant SaaS appointment scheduling platform for service-based businesses (hair salons, veterinary clinics, aesthetics, etc.). Built with Next.js 16 App Router, PostgreSQL, and Prisma.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                       │
│  Landing (RSC)  │  Store Page  │  Dashboard/Owner   │
│  /perfil        │  /admin      │  /onboarding        │
└──────────────┬──────────────────────────────────────┘
               │ HTTP / Server Components
┌──────────────▼──────────────────────────────────────┐
│               API Layer (Route Handlers)             │
│  Stores CRUD  │  Appointments │  Auth (Auth.js v5)  │
│  Calendar     │  Notifications│  Admin               │
└──────────────┬──────────────────────────────────────┘
               │ Prisma ORM
┌──────────────▼──────────────────────────────────────┐
│              PostgreSQL (via Prisma v7)               │
│  12 models: User, Store, Appointment, Review, ...    │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | SSR, RSC, file-based routing, Turbopack |
| **Language** | TypeScript | Full-stack type safety |
| **Database** | PostgreSQL + Prisma v7 | ORM with migrations, driver adapters |
| **Auth** | Auth.js v5 (NextAuth) | Google OAuth, JWT session strategy, PrismaAdapter |
| **Email** | Resend | Transactional emails via API |
| **Calendar** | Google Calendar API v3 | One-way event sync for owners |
| **WhatsApp** | Meta Cloud API (stub) | WABA-ready notification channel |
| **Styling** | CSS Modules + Tailwind CSS | Utility-first + dark mode |

## Key Features

### Role-Based Access
- **Anonymous**: Browse stores, view availability
- **Authenticated (USER)**: Book instantly (CONFIRMED), manage history, favorites, reviews
- **Owner (OWNER)**: Full dashboard — store config, schedule management, PENDING queue
- **Admin (ADMIN)**: Global panel — store oversight, review moderation, integration status

### Booking System
- Slot-based availability computed from business hours, blocked dates, parallel capacity, and daily limits
- Timezone-aware: each store has an IANA timezone; all times stored in UTC
- `getAvailableSlots()` — pure function reusable across owner reschedule and public booking

### Owner Dashboard
- Store configuration: business hours, slot duration, parallel capacity, blocked dates
- Appointment management: confirm, cancel, complete, reschedule (with slot validation)
- Day-view calendar with status-colored time blocks
- PENDING queue with wa.me contact links
- Analytics: totals by status, attendance rate, peak hours, repeat customers

### Notification System
- **Email (Resend)**: Confirmation on booking, cancellation notice, cron-driven reminders
- **Management tokens**: `crypto.randomUUID()` per appointment for anonymous self-service
- **WhatsApp stub**: Architecture-ready for Meta Cloud API activation
- **Cron endpoint**: `/api/cron/reminders` (Bearer auth) — triggers reminders 1 hour before

### Google Calendar Sync
- Separate OAuth2 client (not coupled to Auth.js login)
- Owners opt-in from dashboard; each store has its own token pair
- Auto-refresh with 5-minute expiry buffer
- Create event on CONFIRMED, update on reschedule, delete on cancellation

### Public Landing
- Server Component with search/filter by specialty
- Store cards with average rating (Prisma aggregation)
- Dynamic slot calendar and auth-optional booking form
- Customer profile: appointment history, favorites, reviews

### Admin Panel
- Global metrics: stores, appointments, users, reviews
- Store management: list, suspend/activate
- Review moderation: delete offensive content
- Integration status dashboard: Resend, WhatsApp, Cron, Google Calendar

## Data Model (12 models + 2 enums)

```
User ──1:1── Store ──1:N── Appointment
  │                 ├── BusinessHour
  │                 ├── BlockedDate
  │                 └── CalendarSync (1:1)
  │
  ├── Review (unique per store+user)
  ├── FavoriteStores (M:N via relation table)
  ├── Account (Auth.js)
  ├── Session (Auth.js)
  └── VerificationToken (Auth.js)
```

Key constraints:
- `@@index([storeId, dateTime])` on Appointment — powers all schedule queries
- `@@unique([storeId, userId])` on Review — one review per customer per store
- `managementToken String? @unique` — anonymous booking management
- `googleEventId String?` — Calendar event tracking

## Getting Started

### Prerequisites
- Node.js 24+
- PostgreSQL 18+
- Google OAuth credentials (for Auth.js + Calendar)

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/appointments_db"

# Auth.js (Google OAuth)
AUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Email (Resend)
RESEND_API_KEY="re_..."

# Google Calendar (separate OAuth client)
GOOGLE_CALENDAR_CLIENT_ID="your-calendar-client-id"
GOOGLE_CALENDAR_CLIENT_SECRET="your-calendar-client-secret"

# Cron
CRON_SECRET="your-cron-secret"
APP_URL="http://localhost:3000"
EMAIL_FROM="notificaciones@appointments.app"
```

### Install & Run

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed Data

| Entity | Count | Notes |
|--------|-------|-------|
| Admin | `admin@appointments.app` | ADMIN role |
| Owners | 2 | Each with a store |
| Stores | 2 | Peluquería Central, Veterinaria Norte |
| Business Hours | 12 | Mon–Sat 09:00–18:00 |
| Appointments | 18 | Mixed statuses for testing |

## SDD Development Process

All features were developed using **Spec-Driven Development (SDD)**: each change went through exploration → proposal → spec → design → tasks → apply → verify → archive. Artifacts are preserved in `openspec/specs/` and `openspec/changes/archive/`.

### Change History

| # | Change | Scope |
|---|--------|-------|
| 1 | `inicializacion-db` | Next.js scaffold, Prisma schema, seed |
| 2 | `auth-roles` | Auth.js v5, Google OAuth, proxy.ts route protection |
| 3 | `owner-portal` | Onboarding, dashboard, store config, hours, blocked dates |
| 4 | `owner-appointments` | Appointment CRUD, status machine, PENDING queue, day calendar |
| 5 | `public-booking` | Landing, store detail, booking flow, customer profile |
| 6 | `notifications` | Resend email, management tokens, cron reminders, WhatsApp stub |
| 7 | `google-calendar-sync` | OAuth2, event CRUD, dashboard toggle |
| 8 | `admin-analytics` | Owner stats, admin panel, store suspension, review moderation |

## Future Improvements

- [ ] Test suite (Vitest) — currently verified via `tsc --noEmit` + `next build`
- [ ] WhatsApp real integration (Meta WABA setup + template approval)
- [ ] Two-way Google Calendar sync (webhook for external changes)
- [ ] Pagination for stores, appointments, and reviews
- [ ] Rate limiting on anonymous booking
- [ ] Interactive charts (Recharts) for analytics
