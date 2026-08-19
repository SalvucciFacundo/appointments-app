import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import * as authApi from "@/api/auth"
import type { LoginInput, RegisterInput, User } from "@/api/types"

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (input: LoginInput) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const next = await authApi.login(input)
    setUser(next)
    return next
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    // Registration auto-logs the user in (the backend issues a session), so
    // persist the returned profile just like login does.
    const next = await authApi.register(input)
    setUser(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}