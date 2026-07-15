"use client"

import { useEffect, useState } from "react"
import {
  listAppointments,
  updateAppointmentStatus,
  type AppointmentData,
  type ApiError,
} from "@/lib/appointments"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"

interface TodayAgendaProps {
  storeId: string
  onSelectAppointment?: (apt: AppointmentData) => void
}

const STATUS_GROUPS: Array<{ status: string; label: string; className: string }> = [
  { status: "CONFIRMED", label: "Confirmed", className: "border-l-4 border-blue-500" },
  { status: "PENDING", label: "Pending", className: "border-l-4 border-yellow-500" },
  { status: "COMPLETED", label: "Completed", className: "border-l-4 border-green-500" },
  { status: "CANCELLED", label: "Cancelled", className: "border-l-4 border-red-500" },
]

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

export default function TodayAgenda({ storeId, onSelectAppointment }: TodayAgendaProps) {
  const [appointments, setAppointments] = useState<AppointmentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAppointments(storeId, { date: todayStr() })
      setAppointments(data)
    } catch (err) {
      setError((err as ApiError)?.error ?? "Failed to load appointments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const grouped: Record<string, AppointmentData[]> = {}
  for (const apt of appointments) {
    ;(grouped[apt.status] ??= []).push(apt)
  }

  if (loading) {
    return (
      <Card title="Today's Agenda">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Today's Agenda">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button variant="secondary" onClick={load} className="mt-2">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Card title="Today's Agenda">
      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No appointments today</p>
      ) : (
        <div className="space-y-4">
          {STATUS_GROUPS.map((group) => {
            const items = grouped[group.status]
            if (!items || items.length === 0) return null
            return (
              <div key={group.status}>
                <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {group.label} ({items.length})
                </h3>
                <ul className="space-y-1">
                  {items.map((apt) => (
                    <li key={apt.id}>
                      <button
                        type="button"
                        onClick={() => onSelectAppointment?.(apt)}
                        className={`w-full rounded-md bg-gray-50 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 ${group.className}`}
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatTime(apt.dateTime)}
                        </span>
                        <span className="mx-2 text-gray-400">—</span>
                        <span className="text-gray-700 dark:text-gray-300">{apt.clientName}</span>
                        {apt.service && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {apt.service}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
