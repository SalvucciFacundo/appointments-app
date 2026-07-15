// ---- Types ----

export interface TimeSlot {
  start: string // HH:MM
  end: string   // HH:MM
  available: boolean
  currentBookings: number
}

interface BusinessHourLike {
  dayOfWeek: number
  openTime: string
  closeTime: string
}

interface BlockedDateLike {
  date: string | Date
}

export interface SlotStoreInput {
  businessHours: BusinessHourLike[]
  blockedDates: BlockedDateLike[]
  slotDuration: number
  maxParallelBookings: number
  maxSlotsPerDay: number
  timezone?: string
}

interface ExistingAppointment {
  dateTime: Date
}

// ---- Helpers ----

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function getLocalDate(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function getLocalTime(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
    return `${hour}:${minute}`
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

function dateOnly(value: string | Date): string {
  if (typeof value === "string") return value
  return value.toISOString().slice(0, 10)
}

// ---- Core ----

/**
 * Pure function: computes available time slots for a given date.
 *
 * Rules:
 * - Date must have business hours for the day of week.
 * - Date must not be in blockedDates.
 * - Each slot must have fewer than maxParallelBookings active appointments.
 * - Total slots for the day must not exceed maxSlotsPerDay (0 = unlimited).
 * - Appointment times are converted to the store timezone before comparison.
 *
 * Returns empty array if the date is blocked or has no business hours.
 */
export function getAvailableSlots(
  store: SlotStoreInput,
  date: string, // YYYY-MM-DD
  existing: ExistingAppointment[],
): TimeSlot[] {
  const tz = store.timezone ?? "UTC"

  // 1. Check if date is blocked
  const blocked = store.blockedDates.some(
    (bd) => dateOnly(bd.date) === date,
  )
  if (blocked) return []

  // 2. Find business hours for the day of week
  const dayOfWeek = new Date(date + "T00:00:00").getDay()
  const hours = store.businessHours.find((h) => h.dayOfWeek === dayOfWeek)
  if (!hours) return []

  // 3. Generate slot windows from openTime to closeTime
  const openMin = toMinutes(hours.openTime)
  const closeMin = toMinutes(hours.closeTime)

  const windows: { startMin: number; endMin: number }[] = []
  for (let start = openMin; start + store.slotDuration <= closeMin; start += store.slotDuration) {
    windows.push({ startMin: start, endMin: start + store.slotDuration })
  }

  if (windows.length === 0) return []

  // 4. Filter existing appointments to this local date
  const dateAppointments = existing.filter(
    (apt) => getLocalDate(apt.dateTime, tz) === date,
  )

  const totalOnDate = dateAppointments.length

  // 5. Count bookings per slot window
  const slotCounts = windows.map((w) => {
    const count = dateAppointments.filter((apt) => {
      const aptTime = getLocalTime(apt.dateTime, tz)
      const aptMin = toMinutes(aptTime)
      return aptMin >= w.startMin && aptMin < w.endMin
    }).length
    return count
  })

  // 6. Build result
  const dailyLimit = store.maxSlotsPerDay
  const withinDailyLimit = dailyLimit === 0 || totalOnDate < dailyLimit

  return windows.map((w, i) => {
    const withinCapacity = slotCounts[i] < store.maxParallelBookings
    return {
      start: toTimeString(w.startMin),
      end: toTimeString(w.endMin),
      available: withinCapacity && withinDailyLimit,
      currentBookings: slotCounts[i],
    }
  })
}
