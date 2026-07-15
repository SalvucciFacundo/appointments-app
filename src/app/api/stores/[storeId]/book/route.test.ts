import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    store: { findUnique: vi.fn() },
    appointment: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(() => []) },
    calendarSync: { findUnique: vi.fn() },
    user: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60000 })),
  getClientId: vi.fn(() => "test-client"),
}))
vi.mock("@/lib/email", () => ({ sendConfirmationEmail: vi.fn(() => Promise.resolve()) }))
vi.mock("@/lib/calendar/events", () => ({ createEvent: vi.fn() }))

import { auth } from "@/auth"
import prismaMock from "@/lib/prisma"
import { POST } from "./route"

const mockStore = {
  id: "store-1", name: "Test Store", slug: "test-store",
  timezone: "America/Argentina/Buenos_Aires",
  slotDuration: 60, maxParallelBookings: 2, maxSlotsPerDay: 0,
  businessHours: [{ dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" }],
  blockedDates: [],
}

const validBody = {
  clientName: "Juan Pérez", clientPhone: "+54 11 5555-1234",
  clientEmail: "juan@example.com", dateTime: "2026-07-20T14:00:00.000Z",
  service: "Corte de pelo",
}

function mockAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "apt-1", storeId: "store-1", status: "CONFIRMED",
    managementToken: "tok-123", clientName: validBody.clientName,
    clientPhone: validBody.clientPhone, clientEmail: validBody.clientEmail,
    service: validBody.service, notes: null,
    dateTime: new Date(validBody.dateTime),
    ...overrides,
  }
}

function req(body: unknown, slug = "test-store") {
  return new Request(`http://localhost/api/stores/${slug}/book`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(auth as any).mockResolvedValue({ user: { id: "user-1" } })
  ;(prismaMock as any).store.findUnique.mockResolvedValue(mockStore)
  ;(prismaMock as any).appointment.create.mockResolvedValue(mockAppointment())
})

it("creates CONFIRMED for authenticated users", async () => {
  const res = await POST(req(validBody), { params: Promise.resolve({ storeId: "test-store" }) })
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.status).toBe("CONFIRMED")
})

it("creates PENDING for anonymous users", async () => {
  ;(auth as any).mockResolvedValue(null)
  ;(prismaMock as any).appointment.create.mockResolvedValue(mockAppointment({ status: "PENDING", id: "apt-2" }))
  const res = await POST(req(validBody), { params: Promise.resolve({ storeId: "test-store" }) })
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.status).toBe("PENDING")
})

it("returns 400 when required fields missing", async () => {
  const res = await POST(req({}), { params: Promise.resolve({ storeId: "test-store" }) })
  expect(res.status).toBe(400)
  const data = await res.json()
  expect(data.error).toBe("Validation failed")
})

it("returns 404 when store not found", async () => {
  ;(prismaMock as any).store.findUnique.mockResolvedValue(null)
  const res = await POST(req(validBody), { params: Promise.resolve({ storeId: "x" }) })
  expect(res.status).toBe(404)
})

it("returns 409 when slot outside hours", async () => {
  const res = await POST(req({ ...validBody, dateTime: "2026-07-20T06:00:00.000Z" }), {
    params: Promise.resolve({ storeId: "test-store" }),
  })
  expect(res.status).toBe(409)
})

it("sends confirmation email after booking", async () => {
  const { sendConfirmationEmail } = await import("@/lib/email")
  await POST(req(validBody), { params: Promise.resolve({ storeId: "test-store" }) })
  expect(sendConfirmationEmail).toHaveBeenCalled()
})
