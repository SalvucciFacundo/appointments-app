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
import { useToast } from "@/components/ui/Toast"

interface PendingQueueProps {
  storeId: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function buildWaLink(phone: string, name: string, service: string | null, dateTime: string): string {
  const time = formatTime(dateTime)
  const date = formatDate(dateTime)
  const svc = service ?? "your appointment"
  const message = `Hi ${name}, this is about your ${svc} on ${date} at ${time}.`
  const clean = phone.replace(/\D/g, "")
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

export default function PendingQueue({ storeId }: PendingQueueProps) {
  const { addToast } = useToast()
  const [appointments, setAppointments] = useState<AppointmentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAppointments(storeId, { status: "PENDING" })
      setAppointments(data)
    } catch (err) {
      setError((err as ApiError)?.error ?? "Failed to load pending appointments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (apt: AppointmentData, action: "CONFIRM" | "REJECT") => {
    setActing(apt.id)
    try {
      await updateAppointmentStatus(storeId, apt.id, action)
      setAppointments((prev) => prev.filter((a) => a.id !== apt.id))
      addToast(
        action === "CONFIRM"
          ? `Appointment confirmed — reminder will be sent`
          : `Appointment rejected`,
        "success",
      )
    } catch (err) {
      const msg = (err as ApiError)?.error ?? "Action failed"
      setError(msg)
      addToast(msg, "error")
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <Card title="⏳ Pending Queue">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 skeleton" />
          <div className="h-4 w-1/2 skeleton" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="⏳ Pending Queue">
        <p className="text-xs text-[var(--danger)]">{error}</p>
        <Button variant="secondary" onClick={load} className="mt-2" size="sm">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Card title={`⏳ Pending Queue (${appointments.length})`}>
      {appointments.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">No pending appointments</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {appointments.map((apt) => (
            <li key={apt.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {apt.clientName}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {formatDate(apt.dateTime)} — {formatTime(apt.dateTime)}
                    {apt.service && ` · ${apt.service}`}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{apt.clientPhone}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={buildWaLink(apt.clientPhone, apt.clientName, apt.service, apt.dateTime)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-[var(--radius-md)] bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:opacity-90"
                  >
                    <svg className="mr-1.5 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <Button size="sm" loading={acting === apt.id}
                    onClick={() => handleAction(apt, "CONFIRM")}>
                    Confirm
                  </Button>
                  <Button variant="danger" size="sm" loading={acting === apt.id}
                    onClick={() => handleAction(apt, "REJECT")}>
                    Reject
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
