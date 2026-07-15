import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit, getClientId } from "./rate-limit"

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset the internal store between tests
    // We import the module fresh each time via vitest's isolation
  })

  it("allows requests within the limit", () => {
    const result = checkRateLimit("test-key", 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("blocks when limit is exceeded", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("block-key", 5, 60000)
    }
    const result = checkRateLimit("block-key", 5, 60000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("resets after the window expires", async () => {
    checkRateLimit("reset-key", 1, 50) // 50ms window
    const blocked = checkRateLimit("reset-key", 1, 50)
    expect(blocked.allowed).toBe(false)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60))

    const allowed = checkRateLimit("reset-key", 1, 50)
    expect(allowed.allowed).toBe(true)
  })

  it("tracks different keys independently", () => {
    checkRateLimit("key-a", 1, 60000)
    checkRateLimit("key-b", 1, 60000)

    expect(checkRateLimit("key-a", 1, 60000).allowed).toBe(false)
    expect(checkRateLimit("key-b", 1, 60000).allowed).toBe(false)
  })
})

describe("getClientId", () => {
  it("uses userId when provided", () => {
    const request = new Request("http://localhost")
    const id = getClientId(request, "user-123")
    expect(id).toBe("user:user-123")
  })

  it("falls back to x-forwarded-for IP", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    })
    const id = getClientId(request)
    expect(id).toBe("ip:192.168.1.1")
  })

  it("falls back to unknown when no IP available", () => {
    const request = new Request("http://localhost")
    const id = getClientId(request)
    expect(id).toBe("ip:unknown")
  })
})
