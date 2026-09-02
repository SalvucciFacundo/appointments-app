import { useEffect, useState, type CSSProperties } from "react"
import { listAppointments } from "@/api/appointments"
import type { Appointment, StoreDetail } from "@/api/types"
import { ApiError } from "@/api/client"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"

interface DayCalendarProps {
  storeId: string
  store: StoreDetail
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-[var(--warning-light)] border-[var(--warning)]/30 text-[var(--warning)]",
  CONFIRMED: "bg-[var(--accent-light)] border-[var(--accent-border)] text-[var(--accent)]",
  COMPLETED: "bg-[var(--success-light)] border-[var(--success)]/30 text-[var(--success)]",
  CANCELLED: "bg-[var(--danger-light)] border-[var(--danger)]/30 text-[var(--danger)]",
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function formatTimeLocal(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })
  } catch {
    return new Date(iso).toISOString().slice(11, 16)
  }
}

function getTimeInZone(iso: string, timezone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso))
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10)
    return { hour, minute }
  } catch {
    const d = new Date(iso)
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes() }
  }
}

export default function DayCalendar({ storeId, store }: DayCalendarProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAppointments(storeId, { date: todayStr() })
      setAppointments(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar los turnos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Card title="Calendario del día">
        <div className="animate-pulse space-y-2">
          <div className="h-48 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Calendario del día">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button variant="secondary" onClick={load} className="mt-2">
          Reintentar
        </Button>
      </Card>
    )
  }

  // Build the time grid
  const today = new Date(todayStr() + "T00:00:00")
  const dayOfWeek = today.getDay()
  const bizHours = store.businessHours.find((h) => h.dayOfWeek === dayOfWeek)

  if (!bizHours) {
    return (
      <Card title="Calendario del día">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cerrado hoy</p>
      </Card>
    )
  }

  const openMin = timeToMinutes(bizHours.openTime)
  const closeMin = timeToMinutes(bizHours.closeTime)
  const slotDuration = store.slotDuration

  // Generate time slots
  const timeSlots: string[] = []
  for (let m = openMin; m < closeMin; m += slotDuration) {
    const h = Math.floor(m / 60)
    const min = m % 60
    timeSlots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`)
  }

  const totalMinutes = closeMin - openMin

  // Position each appointment
  const positioned = appointments.map((apt) => {
    const { hour, minute } = getTimeInZone(apt.dateTime, store.timezone)
    const aptMin = hour * 60 + minute

    if (aptMin < openMin || aptMin >= closeMin) return null

    const topPercent = ((aptMin - openMin) / totalMinutes) * 100
    return { ...apt, topPercent }
  }).filter(Boolean) as Array<Appointment & { topPercent: number }>

  return (
    <Card title="Calendario del día">
      <div className="relative" style={{ minHeight: `${timeSlots.length * 48}px` }}>
        {/* Time column + grid lines */}
        <div className="absolute inset-y-0 left-0 w-16">
          {timeSlots.map((time) => (
            <div
              key={time}
              className="flex h-12 items-start border-t border-gray-100 pt-0.5 dark:border-gray-800"
            >
              <span className="text-xs text-gray-400 dark:text-gray-500">{time}</span>
            </div>
          ))}
        </div>

        {/* Appointment blocks */}
        <div className="relative ml-16" style={{ height: `${timeSlots.length * 48}px`, paddingTop: "12px" }}>
          {timeSlots.map((time) => (
            <div
              key={time}
              className="h-12 border-t border-gray-100 dark:border-gray-800"
            />
          ))}

          {positioned.map((apt) => {
            const heightPx = Math.max(40, (slotDuration / totalMinutes) * timeSlots.length * 48)

            const style: CSSProperties = {
              position: "absolute",
              top: `calc(${apt.topPercent}% + 12px)`,
              left: "4px",
              right: "4px",
              height: `${heightPx}px`,
              zIndex: 10,
            }

            return (
              <div
                key={apt.id}
                className={`overflow-hidden rounded border px-2 py-0.5 text-xs ${STATUS_COLORS[apt.status] ?? STATUS_COLORS.PENDING}`}
                style={style}
                title={`${apt.clientName} — ${apt.service ?? "Sin servicio"} — ${apt.status}`}
              >
                <div className="truncate font-medium">{apt.clientName}</div>
                <div className="truncate opacity-75">
                  {formatTimeLocal(apt.dateTime, store.timezone)}
                  {apt.service && ` · ${apt.service}`}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
