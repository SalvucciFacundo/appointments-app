"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import Link from "next/link"
import Card from "@/components/ui/Card"

interface Appointment {
  id: string
  storeName: string
  storeSlug: string
  clientName: string
  dateTime: string
  service: string | null
  status: string
  notes: string | null
}

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-[var(--info-light)] text-[var(--info)]",
  PENDING: "bg-[var(--warning-light)] text-[var(--warning)]",
  CANCELLED: "bg-[var(--danger-light)] text-[var(--danger)]",
  COMPLETED: "bg-[var(--success-light)] text-[var(--success)]",
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendiente",
  CANCELLED: "Cancelado",
  COMPLETED: "Completado",
}

export default function PerfilPage() {
  const { data: session, status } = useSession()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") return

    fetch("/api/user/appointments")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar turnos")
        return res.json()
      })
      .then((data) => setAppointments(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [status])

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 animate-fadeIn">
        <Card>
          <div className="space-y-3 animate-pulse">
            <div className="h-6 w-40 skeleton" />
            <div className="h-4 w-full skeleton" />
            <div className="h-4 w-3/4 skeleton" />
          </div>
        </Card>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Mis Turnos
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {session.user?.name ?? session.user?.email}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--danger-light)] px-4 py-3">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {appointments.length === 0 && !error && (
        <Card className="text-center py-10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--bg-muted)]">
            <svg className="h-6 w-6 text-[var(--text-tertiary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">No tenés turnos reservados todavía.</p>
          <Link href="/"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            Buscar comercios →
          </Link>
        </Card>
      )}

      <div className="space-y-3">
        {appointments.map((apt) => (
          <div key={apt.id}
            className="rounded-[var(--radius-lg)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)] border border-[var(--border-subtle)] transition-all duration-150 hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Link href={`/${apt.storeSlug}`}
                  className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
                  {apt.storeName}
                </Link>
                <p className="mt-1 text-sm text-[var(--text-primary)]">
                  {new Date(apt.dateTime).toLocaleDateString("es-AR", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  })}
                  {" — "}
                  {new Date(apt.dateTime).toLocaleTimeString("es-AR", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                {apt.service && (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{apt.service}</p>
                )}
              </div>
              <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[apt.status] ?? "bg-[var(--bg-muted)] text-[var(--text-tertiary)]"}`}>
                {STATUS_LABELS[apt.status] ?? apt.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
