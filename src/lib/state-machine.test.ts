import { describe, it, expect } from "vitest"
import {
  isValidAction,
  getTargetStatus,
  isValidTransition,
  validateTransition,
} from "./state-machine"

describe("isValidAction", () => {
  it("accepts valid actions", () => {
    expect(isValidAction("CONFIRM")).toBe(true)
    expect(isValidAction("REJECT")).toBe(true)
    expect(isValidAction("COMPLETE")).toBe(true)
  })

  it("rejects invalid actions", () => {
    expect(isValidAction("DELETE")).toBe(false)
    expect(isValidAction("")).toBe(false)
    expect(isValidAction("confirm")).toBe(false) // case-sensitive
  })
})

describe("getTargetStatus", () => {
  it("maps CONFIRM → CONFIRMED", () => {
    expect(getTargetStatus("CONFIRM")).toBe("CONFIRMED")
  })

  it("maps REJECT → CANCELLED", () => {
    expect(getTargetStatus("REJECT")).toBe("CANCELLED")
  })

  it("maps COMPLETE → COMPLETED", () => {
    expect(getTargetStatus("COMPLETE")).toBe("COMPLETED")
  })

  it("is case-insensitive", () => {
    expect(getTargetStatus("confirm")).toBe("CONFIRMED")
    expect(getTargetStatus("Confirm")).toBe("CONFIRMED")
  })

  it("returns null for unknown action", () => {
    expect(getTargetStatus("DELETE")).toBeNull()
  })
})

describe("isValidTransition", () => {
  it("allows PENDING → CONFIRMED", () => {
    expect(isValidTransition("PENDING", "CONFIRMED")).toBe(true)
  })

  it("allows PENDING → CANCELLED", () => {
    expect(isValidTransition("PENDING", "CANCELLED")).toBe(true)
  })

  it("allows CONFIRMED → COMPLETED", () => {
    expect(isValidTransition("CONFIRMED", "COMPLETED")).toBe(true)
  })

  it("allows CONFIRMED → CANCELLED", () => {
    expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true)
  })

  it("blocks CANCELLED → CONFIRMED (terminal)", () => {
    expect(isValidTransition("CANCELLED", "CONFIRMED")).toBe(false)
  })

  it("blocks COMPLETED → CANCELLED (terminal)", () => {
    expect(isValidTransition("COMPLETED", "CANCELLED")).toBe(false)
  })

  it("blocks PENDING → COMPLETED (skip CONFIRMED)", () => {
    expect(isValidTransition("PENDING", "COMPLETED")).toBe(false)
  })
})

describe("validateTransition (full integration)", () => {
  it("returns valid for PENDING + CONFIRM", () => {
    const result = validateTransition("PENDING", "CONFIRM")
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.targetStatus).toBe("CONFIRMED")
  })

  it("returns error for invalid action string", () => {
    const result = validateTransition("PENDING", "")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("action is required")
  })

  it("returns error for unknown action", () => {
    const result = validateTransition("PENDING", "DELETE")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("must be CONFIRM")
  })

  it("returns error for invalid transition", () => {
    const result = validateTransition("COMPLETED", "CONFIRM")
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("Cannot transition")
  })
})
