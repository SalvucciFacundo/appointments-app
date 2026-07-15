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
  const [acting, setActing] = useState<string | null>(null) // appointment id being acted on

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
      // Optimistic: remove from queue
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
      <Card title="Pending Queue">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Pending Queue">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button variant="secondary" onClick={load} className="mt-2">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <Card title={`Pending Queue (${appointments.length})`}>
      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No pending appointments</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {appointments.map((apt) => (
            <li key={apt.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {apt.clientName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(apt.dateTime)} — {formatTime(apt.dateTime)}
                    {apt.service && ` · ${apt.service}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{apt.clientPhone}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={buildWaLink(
                      apt.clientPhone,
                      apt.clientName,
                      apt.service,
                      apt.dateTime,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
                  >
                    WhatsApp
                  </a>
                  <Button
                    variant="primary"
                    loading={acting === apt.id}
                    onClick={() => handleAction(apt, "CONFIRM")}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="danger"
                    loading={acting === apt.id}
                    onClick={() => handleAction(apt, "REJECT")}
                  >
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
