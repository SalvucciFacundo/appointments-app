"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import Link from "next/link"

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

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
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
        if (!res.ok) throw new Error("Failed to load appointments")
        return res.json()
      })
      .then((data) => setAppointments(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [status])

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (!session) {
    return null // proxy.ts redirects
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Mis Turnos
      </h1>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {appointments.length === 0 && !error && (
        <p className="mt-8 text-center text-gray-500 dark:text-gray-400">
          No tenés turnos reservados todavía.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {appointments.map((apt) => (
          <div
            key={apt.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/${apt.storeSlug}`}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {apt.storeName}
                </Link>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {new Date(apt.dateTime).toLocaleDateString("es-AR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  —{" "}
                  {new Date(apt.dateTime).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {apt.service && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {apt.service}
                  </p>
                )}
              </div>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[apt.status] ?? "bg-gray-100 text-gray-800"
                }`}
              >
                {STATUS_LABELS[apt.status] ?? apt.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
