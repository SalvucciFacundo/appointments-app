import { describe, it, expect } from "vitest"
import { validateTimeFormat, validateDayOfWeek, validateFutureDate } from "./validators"

describe("validateTimeFormat", () => {
  it("accepts valid HH:MM times", () => {
    expect(validateTimeFormat("09:00", "openTime")).toBeNull()
    expect(validateTimeFormat("00:00", "openTime")).toBeNull()
    expect(validateTimeFormat("23:59", "closeTime")).toBeNull()
  })

  it("rejects invalid formats", () => {
    expect(validateTimeFormat("9:00", "openTime")).toBe("openTime must be in HH:MM format")
    expect(validateTimeFormat("25:00", "openTime")).toBe("openTime must be in HH:MM format")
    expect(validateTimeFormat("09:60", "closeTime")).toBe("closeTime must be in HH:MM format")
    expect(validateTimeFormat("", "openTime")).toBe("openTime must be in HH:MM format")
  })
})

describe("validateDayOfWeek", () => {
  it("accepts 0-6", () => {
    expect(validateDayOfWeek(0)).toBeNull()
    expect(validateDayOfWeek(3)).toBeNull()
    expect(validateDayOfWeek(6)).toBeNull()
  })

  it("rejects out of range", () => {
    expect(validateDayOfWeek(-1)).toBe("dayOfWeek must be an integer between 0 and 6")
    expect(validateDayOfWeek(7)).toBe("dayOfWeek must be an integer between 0 and 6")
  })

  it("rejects non-integers", () => {
    expect(validateDayOfWeek(1.5)).toBe("dayOfWeek must be an integer between 0 and 6")
  })
})

describe("validateFutureDate", () => {
  it("accepts a future date", () => {
    expect(validateFutureDate("2030-01-01")).toBeNull()
  })

  it("rejects a past date", () => {
    expect(validateFutureDate("2020-01-01")).toBe("Date must be in the future")
  })

  it("rejects invalid date strings", () => {
    expect(validateFutureDate("not-a-date")).toBe("Invalid date format. Use YYYY-MM-DD")
    expect(validateFutureDate("")).toBe("Invalid date format. Use YYYY-MM-DD")
  })
})
