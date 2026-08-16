import { describe, it, expect, vi, beforeEach } from "vitest"
import { request, ApiError } from "@/api/client"

describe("request", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses the Go error contract {error:{code,message,field}}", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "slot_unavailable", message: "slot is no longer available", field: "" } }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    )

    const err = await request<never>("/api/stores/foo/book").catch((e) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.code).toBe("slot_unavailable")
    expect(err.message).toBe("slot is no longer available")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("propagates validation errors with field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "validation", message: "clientName is required", field: "clientName" } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    )

    const err = await request<never>("/api/stores/foo/book").catch((e) => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.field).toBe("clientName")
  })

  it("sends the X-API-Key header for owner requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
    )

    await request("/api/stores", { method: "GET", apiKey: "secret" })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get("X-API-Key")).toBe("secret")
  })

  it("encodes JSON bodies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "Content-Type": "application/json" } }),
    )

    const body = { date: "2026-08-15", time: "10:00", clientName: "Ana" }
    await request("/api/stores/foo/book", { method: "POST", body })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual(body)
  })
})
