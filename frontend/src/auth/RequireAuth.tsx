import { useEffect, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/auth/AuthContext"
import { setOnUnauthorized, redirectToLogin } from "@/api/client"

/** Guards a protected route: shows a spinner while the session resolves and
 * redirects to /login when there is no authenticated user. While mounted it
 * also redirects to /login when any owner request answers 401 (expired
 * session). */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    setOnUnauthorized(redirectToLogin)
    return () => setOnUnauthorized(null)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}