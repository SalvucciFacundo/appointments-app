// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/auth/AuthContext"
import RequireAuth from "@/auth/RequireAuth"
import { setOnUnauthorized } from "@/api/client"
import { me } from "@/api/auth"

vi.mock("@/api/auth", () => ({
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}))

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div>panel</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe("RequireAuth", () => {
  beforeEach(() => {
    setOnUnauthorized(null)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("redirects to /login when there is no authenticated user", async () => {
    vi.mocked(me).mockRejectedValue(new Error("unauthorized"))

    renderGuard()

    expect(await screen.findByText("login-page")).toBeTruthy()
    expect(screen.queryByText("panel")).toBeNull()
  })

  it("renders children for an authenticated user", async () => {
    vi.mocked(me).mockResolvedValue({ id: "1", name: "Ana", email: "ana@example.com", role: "OWNER" })

    renderGuard()

    expect(await screen.findByText("panel")).toBeTruthy()
    expect(screen.queryByText("login-page")).toBeNull()
  })
})