"use client"

import { useEffect, useState } from "react"
import { listAppointments, type AppointmentData, type ApiError } from "@/lib/appointments"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"

interface TodayAgendaProps {
  storeId: string
  onSelectAppointment?: (apt: AppointmentData) => void
}

const STATUS_GROUPS: Array<{ status: string; label: string; color: string }> = [
  { status: "CONFIRMED", label: "Confirmed", color: "border-l-[3px] border-l-[var(--info)]" },
  { status: "PENDING", label: "Pending", color: "border-l-[3px] border-l-[var(--warning)]" },
  { status: "COMPLETED", label: "Completed", color: "border-l-[3px] border-l-[var(--success)]" },
  { status: "CANCELLED", label: "Cancelled", color: "border-l-[3px] border-l-[var(--danger)]" },
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
      <Card title="📋 Today&apos;s Agenda">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 skeleton" />
          <div className="h-4 w-1/2 skeleton" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="📋 Today&apos;s Agenda">
        <p className="text-xs text-[var(--danger)]">{error}</p>
        <Button variant="secondary" onClick={load} className="mt-2" size="sm">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Card title={`📋 Today&apos;s Agenda (${appointments.length})`}>
      {appointments.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">No appointments today</p>
      ) : (
        <div className="space-y-4">
          {STATUS_GROUPS.map((group) => {
            const items = grouped[group.status]
            if (!items || items.length === 0) return null
            return (
              <div key={group.status}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {group.label} ({items.length})
                </h3>
                <ul className="space-y-1">
                  {items.map((apt) => (
                    <li key={apt.id}>
                      <button
                        type="button"
                        onClick={() => onSelectAppointment?.(apt)}
                        className={`w-full rounded-[var(--radius-md)] bg-[var(--bg-muted)] px-3 py-2 text-left text-sm
                          transition-all duration-150 hover:bg-[var(--bg-hover)] ${group.color}`}
                      >
                        <span className="font-medium text-[var(--text-primary)]">
                          {formatTime(apt.dateTime)}
                        </span>
                        <span className="mx-2 text-[var(--text-tertiary)]">—</span>
                        <span className="text-[var(--text-secondary)]">{apt.clientName}</span>
                        {apt.service && (
                          <span className="ml-2 text-xs text-[var(--text-tertiary)]">
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
