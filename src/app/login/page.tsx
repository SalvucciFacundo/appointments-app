"use client"

import { useState, type FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/Toast"

const DEMO_ACCOUNTS = [
  { email: "admin@appointments.app", role: "Admin", label: "Admin" },
  { email: "owner1@test.com", role: "OWNER", label: "Dueño (Peluquería)" },
  { email: "owner2@test.com", role: "OWNER", label: "Dueño (Veterinaria)" },
  { email: "customer@test.com", role: "USER", label: "Cliente" },
]

export default function LoginPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Credenciales inválidas. Usá 'demo123' como contraseña.")
        return
      }

      addToast("Sesión iniciada correctamente", "success")
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (userEmail: string) => {
    setEmail(userEmail)
    setPassword("demo123")
    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email: userEmail,
        password: "demo123",
        redirect: false,
      })

      if (result?.error) {
        setError("Error al iniciar sesión.")
        setLoading(false)
        return
      }

      addToast("Sesión iniciada correctamente", "success")
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Error de conexión.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fadeIn">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-emerald-600 shadow-lg shadow-emerald-500/20">
            <svg className="h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Iniciar sesión
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Ingresá a tu panel de gestión de turnos
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                transition-all duration-150"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
                transition-all duration-150"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--danger-light)] px-4 py-3">
              <p className="text-xs text-[var(--danger)]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--accent)] to-emerald-600 px-4 py-2.5 text-sm font-medium text-white
              shadow-lg shadow-emerald-500/20
              hover:shadow-xl hover:shadow-emerald-500/30 hover:opacity-95
              active:opacity-90
              disabled:cursor-not-allowed disabled:opacity-50
              transition-all duration-150"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ingresando...
              </span>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        {/* Demo accounts quick login */}
        <div className="mt-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-subtle)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--bg-page)] px-2 text-[var(--text-tertiary)]">
                Acceso rápido (contraseña: demo123)
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => quickLogin(account.email)}
                disabled={loading}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 text-left
                  hover:bg-[var(--bg-hover)] hover:border-[var(--border-default)]
                  transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{account.label}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{account.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
