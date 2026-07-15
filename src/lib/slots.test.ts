import { describe, it, expect } from "vitest"
import { getAvailableSlots, type SlotStoreInput } from "./slots"

const baseStore: SlotStoreInput = {
  businessHours: [
    { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" }, // Monday
    { dayOfWeek: 2, openTime: "09:00", closeTime: "18:00" }, // Tuesday
  ],
  blockedDates: [],
  slotDuration: 60,
  maxParallelBookings: 2,
  maxSlotsPerDay: 0, // unlimited
  timezone: "America/Argentina/Buenos_Aires",
}

describe("getAvailableSlots", () => {
  it("returns slots for a valid business day", () => {
    const slots = getAvailableSlots(baseStore, "2026-07-20", [])
    // Monday: 09:00-18:00 with 60min slots = 9 slots
    expect(slots).toHaveLength(9)
    expect(slots[0]).toEqual({
      start: "09:00",
      end: "10:00",
      available: true,
      currentBookings: 0,
    })
    expect(slots[8]).toEqual({
      start: "17:00",
      end: "18:00",
      available: true,
      currentBookings: 0,
    })
  })

  it("returns empty array for a blocked date", () => {
    const store = {
      ...baseStore,
      blockedDates: [{ date: "2026-07-20" }],
    }
    const slots = getAvailableSlots(store, "2026-07-20", [])
    expect(slots).toHaveLength(0)
  })

  it("returns empty array for a day with no business hours (Sunday)", () => {
    const slots = getAvailableSlots(baseStore, "2026-07-19", []) // Sunday
    expect(slots).toHaveLength(0)
  })

  it("respects maxParallelBookings capacity", () => {
    const existing = [
      { dateTime: new Date("2026-07-20T09:00:00-03:00") },
      { dateTime: new Date("2026-07-20T09:00:00-03:00") }, // 2 at same slot = full
    ]
    const slots = getAvailableSlots(baseStore, "2026-07-20", existing)
    expect(slots[0].available).toBe(false)
    expect(slots[0].currentBookings).toBe(2)
    expect(slots[1].available).toBe(true) // 10:00 slot should be free
  })

  it("respects maxSlotsPerDay limit", () => {
    const store = { ...baseStore, maxSlotsPerDay: 3 }
    // With 3 existing appointments, only 3+1=4th slot should be unavailable
    // Actually: dailyLimit = 3, totalOnDate = 3, 3 < 3 = false → all unavailable
    const existing = [
      { dateTime: new Date("2026-07-20T09:00:00-03:00") },
      { dateTime: new Date("2026-07-20T10:00:00-03:00") },
      { dateTime: new Date("2026-07-20T11:00:00-03:00") },
    ]
    const slots = getAvailableSlots(store, "2026-07-20", existing)
    const available = slots.filter((s) => s.available)
    // maxSlotsPerDay=3, totalOnDate=3 → no more allowed
    expect(available).toHaveLength(0)
  })

  it("handles cross-midnight hours (closeTime <= openTime)", () => {
    const store: SlotStoreInput = {
      ...baseStore,
      businessHours: [{ dayOfWeek: 1, openTime: "20:00", closeTime: "02:00" }],
      slotDuration: 60,
    }
    // For cross-midnight, the current logic won't generate slots
    // because closeMin (120) < openMin (1200) — loop doesn't execute
    const slots = getAvailableSlots(store, "2026-07-20", [])
    // This documents current behavior: cross-midnight not supported
    expect(slots).toHaveLength(0)
  })

  it("handles empty business hours", () => {
    const store = { ...baseStore, businessHours: [] }
    const slots = getAvailableSlots(store, "2026-07-20", [])
    expect(slots).toHaveLength(0)
  })

  it("is timezone-aware: converts existing appointments to store timezone", () => {
    // Appointment at 12:00 UTC = 09:00 in Buenos Aires (UTC-3)
    const existing = [
      { dateTime: new Date("2026-07-20T12:00:00Z") },
      { dateTime: new Date("2026-07-20T12:00:00Z") }, // fill capacity (maxParallelBookings=2)
    ]
    const store = { ...baseStore, maxParallelBookings: 2 }
    const slots = getAvailableSlots(store, "2026-07-20", existing)
    // First slot (09:00 BsAs) should be fully booked (2/2)
    expect(slots[0].currentBookings).toBe(2)
    expect(slots[0].available).toBe(false)
    // Second slot (10:00) should still be available
    expect(slots[1].available).toBe(true)
  })
})
