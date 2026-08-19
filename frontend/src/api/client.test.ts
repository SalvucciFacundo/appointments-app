import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { request, ApiError, setOnUnauthorized } from "@/api/client"

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  )
}

describe("request", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setOnUnauthorized(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parses the Go error contract {error:{code,message,field}}", async () => {
    mockFetch(409, { error: { code: "slot_unavailable", message: "slot is no longer available", field: "" } })

    const err = await request<never>("/api/stores/foo/book").catch((e) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.code).toBe("slot_unavailable")
    expect(err.message).toBe("slot is no longer available")
  })

  it("propagates validation errors with field", async () => {
    mockFetch(400, { error: { code: "validation", message: "clientName is required", field: "clientName" } })

    const err = await request<never>("/api/stores/foo/book").catch((e) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.field).toBe("clientName")
  })

  it("always sends credentials", async () => {
    const fetchMock = mockFetch(200, [])
    await request("/api/stores")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe("include")
  })

  it("injects the CSRF token on mutations from the csrf_token cookie", async () => {
    vi.stubGlobal("document", { cookie: "session=abc; csrf_token=tok123" })
    const fetchMock = mockFetch(200, {})
    await request("/api/stores", { method: "POST", body: {} })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get("X-CSRF-Token")).toBe("tok123")
  })

  it("does not set the CSRF header or Content-Type on GET", async () => {
    vi.stubGlobal("document", { cookie: "session=abc; csrf_token=tok123" })
    const fetchMock = mockFetch(200, [])
    await request("/api/stores")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("X-CSRF-Token")).toBeNull()
    expect(headers.get("Content-Type")).toBeNull()
  })

  it("never sends the X-API-Key header", async () => {
    const fetchMock = mockFetch(200, [])
    await request("/api/stores")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get("X-API-Key")).toBeNull()
  })

  it("invokes the onUnauthorized hook on 401", async () => {
    const handler = vi.fn()
    setOnUnauthorized(handler)
    mockFetch(401, { error: { code: "unauthorized", message: "authentication required" } })

    const err = await request<never>("/api/stores").catch((e) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("does not read localStorage", async () => {
    const getItem = vi.fn()
    vi.stubGlobal("localStorage", { getItem, setItem: vi.fn(), removeItem: vi.fn() })
    mockFetch(200, [])
    await request("/api/stores")
    expect(getItem).not.toHaveBeenCalled()
  })

  it("encodes JSON bodies", async () => {
    const fetchMock = mockFetch(201, { ok: true })

    const body = { date: "2026-08-15", time: "10:00", clientName: "Ana" }
    await request("/api/stores/foo/book", { method: "POST", body })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual(body)
  })
})