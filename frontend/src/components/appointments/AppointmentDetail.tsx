import { useState, type FormEvent } from "react"
import { updateStatus, reschedule } from "@/api/appointments"
import type { Appointment, AppointmentAction } from "@/api/types"
import { ApiError } from "@/api/client"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"

interface AppointmentDetailProps {
  appointment: Appointment | null
  storeId: string
  onClose: () => void
  onStatusChanged: () => void // callback to refresh parent lists
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  })
}

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20",
  CONFIRMED: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
  COMPLETED: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
  CANCELLED: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
}

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

export default function AppointmentDetail({
  appointment,
  storeId,
  onClose,
  onStatusChanged,
}: AppointmentDetailProps) {
  const { addToast } = useToast()
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)

  if (!appointment) return null

  const actionLabels: Record<string, string> = {
    CONFIRM: "confirmado",
    REJECT: "cancelado",
    COMPLETE: "completado",
  }

  const handleAction = async (action: AppointmentAction) => {
    setActing(true)
    setError(null)
    try {
      await updateStatus(storeId, appointment.id, action)
      addToast(`Turno ${actionLabels[action] ?? action.toLowerCase()} correctamente`, "success")
      onStatusChanged()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo completar la acción"
      setError(msg)
      addToast(msg, "error")
    } finally {
      setActing(false)
    }
  }

  const handleReschedule = async (e: FormEvent) => {
    e.preventDefault()
    if (!newDate || !newTime) return

    setRescheduling(true)
    setRescheduleError(null)
    try {
      await reschedule(storeId, appointment.id, { date: newDate, time: newTime })
      setShowReschedule(false)
      setNewDate("")
      setNewTime("")
      addToast("Turno reprogramado correctamente", "success")
      onStatusChanged()
    } catch (err) {
      setRescheduleError(err instanceof ApiError ? err.message : "No se pudo reprogramar el turno")
    } finally {
      setRescheduling(false)
    }
  }

  // Determine available actions based on current status
  const availableActions: Array<{ label: string; action: AppointmentAction; variant: "primary" | "danger" | "secondary" }> = []

  if (appointment.status === "PENDING") {
    availableActions.push({ label: "Confirmar", action: "CONFIRM", variant: "primary" })
    availableActions.push({ label: "Rechazar", action: "REJECT", variant: "danger" })
  }

  if (appointment.status === "CONFIRMED") {
    availableActions.push({ label: "Completar", action: "COMPLETE", variant: "primary" })
    availableActions.push({ label: "Cancelar", action: "REJECT", variant: "danger" })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Detalle del turno
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status badge */}
        <div className="mb-4">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASSES[appointment.status] ?? ""}`}
          >
            {appointment.status}
          </span>
        </div>

        {/* Client info */}
        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Cliente</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{appointment.clientName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Teléfono</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{appointment.clientPhone}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">{appointment.clientEmail}</dd>
          </div>
          {appointment.service && (
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Servicio</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{appointment.service}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Fecha y hora</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {formatDateTime(appointment.dateTime)}
            </dd>
          </div>
          {appointment.notes && (
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Notas</dt>
              <dd className="max-w-[60%] text-right font-medium text-gray-900 dark:text-gray-100">
                {appointment.notes}
              </dd>
            </div>
          )}
        </dl>

        {/* Error */}
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Action buttons */}
        <div className="mb-4 flex flex-wrap gap-2">
          {availableActions.map((a) => (
            <Button
              key={a.action}
              variant={a.variant}
              loading={acting}
              onClick={() => handleAction(a.action)}
            >
              {a.label}
            </Button>
          ))}

          <Button
            variant="secondary"
            onClick={() => {
              setShowReschedule(!showReschedule)
              setRescheduleError(null)
            }}
          >
            Reprogramar
          </Button>
        </div>

        {/* Reschedule form */}
        {showReschedule && (
          <form onSubmit={handleReschedule} className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Nueva fecha y hora
            </h4>
            <div className="space-y-3">
              <Input
                label="Fecha"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.currentTarget.value)}
              />
              <Input
                label="Hora"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.currentTarget.value)}
                hint={DAY_NAMES[new Date(`${newDate}T12:00:00`).getDay()] || undefined}
              />
            </div>
            {rescheduleError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{rescheduleError}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button type="submit" loading={rescheduling}>
                Confirmar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowReschedule(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
