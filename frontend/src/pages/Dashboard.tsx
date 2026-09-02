import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  listOwnerStores,
  getStore,
  updateStore,
  replaceHours,
  addBlockedDate,
  deleteBlockedDate,
} from "@/api/stores"
import { useAuth } from "@/auth/AuthContext"
import type { Store, StoreDetail, BusinessHourInput, Appointment } from "@/api/types"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import TodayAgenda from "@/components/appointments/TodayAgenda"
import PendingQueue from "@/components/appointments/PendingQueue"
import DayCalendar from "@/components/appointments/DayCalendar"
import AppointmentDetail from "@/components/appointments/AppointmentDetail"

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 skeleton" />
      <div className="h-4 w-full skeleton" />
      <div className="h-4 w-3/4 skeleton" />
    </div>
  )
}

export default function Dashboard() {
  const { addToast } = useToast()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [stores, setStores] = useState<Store[]>([])
  const [store, setStore] = useState<StoreDetail | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [storesLoading, setStoresLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editSpecialty, setEditSpecialty] = useState("")
  const [editLatitude, setEditLatitude] = useState("")
  const [editLongitude, setEditLongitude] = useState("")

  // Hours
  const [hours, setHours] = useState<BusinessHourInput[]>(
    DAY_LABELS.map((_, i) => ({ dayOfWeek: i, openTime: "09:00", closeTime: "18:00" })),
  )

  // Slot settings
  const [slotDuration, setSlotDuration] = useState(60)
  const [maxParallelBookings, setMaxParallelBookings] = useState(1)
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState(0)
  const [cancelationLimit, setCancelationLimit] = useState(2)

  // Blocked dates
  const [newBlockedDate, setNewBlockedDate] = useState("")
  const [newBlockedReason, setNewBlockedReason] = useState("")

  // Appointment detail modal
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0)

  const loadStores = useCallback(async () => {
    setStoresLoading(true)
    setError(null)
    try {
      const data = await listOwnerStores()
      setStores(data)
      if (data.length > 0) {
        setSelectedStoreId((prev) => (data.some((s) => s.id === prev) ? prev : data[0].id))
      } else {
        setSelectedStoreId("")
        setStore(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar los comercios"
      setError(msg)
      setStores([])
      setStore(null)
    } finally {
      setStoresLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStores()
  }, [loadStores])

  const loadStore = useCallback(
    async (storeId: string) => {
      setLoading(true)
      setError(null)
      try {
        const data = await getStore(storeId)
        setStore(data)
        setEditName(data.name)
        setEditDescription(data.description ?? "")
        setEditAddress(data.address)
        setEditPhone(data.phone ?? "")
        setEditSpecialty(data.specialty)
        setEditLatitude(data.latitude?.toString() ?? "")
        setEditLongitude(data.longitude?.toString() ?? "")
        setSlotDuration(data.slotDuration)
        setMaxParallelBookings(data.maxParallelBookings)
        setMaxSlotsPerDay(data.maxSlotsPerDay)
        setCancelationLimit(data.cancelationLimit)

        setHours(
          DAY_LABELS.map((_, i) => {
            const existing = data.businessHours.find((h) => h.dayOfWeek === i)
            return existing
              ? { dayOfWeek: i, openTime: existing.openTime, closeTime: existing.closeTime }
              : { dayOfWeek: i, openTime: "09:00", closeTime: "18:00" }
          }),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el comercio")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (selectedStoreId) loadStore(selectedStoreId)
  }, [selectedStoreId, loadStore])

  // ---- Save Handlers ----

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault()
    if (!store) return

    setSaving("info")
    try {
      const updated = await updateStore(
        store.id,
        {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          address: editAddress.trim(),
          phone: editPhone.trim() || undefined,
          specialty: editSpecialty.trim(),
          latitude: editLatitude ? parseFloat(editLatitude) : undefined,
          longitude: editLongitude ? parseFloat(editLongitude) : undefined,
        },
      )
      setStore((prev) => (prev ? { ...prev, ...updated } : prev))
      setStores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      addToast("Datos del comercio actualizados", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "No se pudieron guardar los datos", "error")
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveHours() {
    if (!store) return

    setSaving("hours")
    try {
      const updated = await replaceHours(store.id, hours)
      setStore((prev) => (prev ? { ...prev, businessHours: updated } : prev))
      addToast("Horarios actualizados", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "No se pudieron guardar los horarios", "error")
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveSlots() {
    if (!store) return

    setSaving("slots")
    try {
      const updated = await updateStore(
        store.id,
        {
          slotDuration,
          maxParallelBookings,
          maxSlotsPerDay,
          cancelationLimit,
        },
      )
      setStore((prev) => (prev ? { ...prev, ...updated } : prev))
      addToast("Configuración de turnos actualizada", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "No se pudo guardar la configuración", "error")
    } finally {
      setSaving(null)
    }
  }

  async function handleAddBlockedDate() {
    if (!store || !newBlockedDate) return

    setSaving("blocked")
    try {
      const bd = await addBlockedDate(store.id, { date: newBlockedDate, reason: newBlockedReason.trim() || undefined })
      setStore((prev) =>
        prev
          ? {
              ...prev,
              blockedDates: [...prev.blockedDates, bd],
            }
          : prev,
      )
      setNewBlockedDate("")
      setNewBlockedReason("")
      addToast("Fecha bloqueada", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "No se pudo bloquear la fecha", "error")
    } finally {
      setSaving(null)
    }
  }

  async function handleRemoveBlockedDate(blockedDateId: string) {
    if (!store) return

    setSaving("blocked")
    try {
      await deleteBlockedDate(store.id, blockedDateId)
      setStore((prev) =>
        prev
          ? {
              ...prev,
              blockedDates: prev.blockedDates.filter((bd) => bd.id !== blockedDateId),
            }
          : prev,
      )
      addToast("Fecha desbloqueada", "success")
    } catch (err) {
      addToast(err instanceof Error ? err.message : "No se pudo desbloquear la fecha", "error")
    } finally {
      setSaving(null)
    }
  }

  if (storesLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <Skeleton />
        </Card>
      </div>
    )
  }

  if (error && stores.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Button variant="secondary" onClick={() => loadStores()} className="mt-4">
            Reintentar
          </Button>
        </Card>
      </div>
    )
  }

  if (stores.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <p className="text-sm text-[var(--text-tertiary)]">
            No se encontraron comercios para esta cuenta.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 animate-fadeIn">
      {/* Header with store selector */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
        {stores.length > 1 && (
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs
              text-[var(--text-primary)] hover:border-[var(--border-strong)]
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
              transition-all duration-150"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {user.name} · {user.email}
            </span>
          )}
          <button
            onClick={async () => {
              await logout()
              navigate("/login")
            }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium
              text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
              transition-all duration-150"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {loading ? (
        <Card>
          <Skeleton />
        </Card>
      ) : !store ? (
        <Card>
          <p className="text-sm text-[var(--text-tertiary)]">No se pudo cargar el comercio.</p>
        </Card>
      ) : (
        <>
          {/* Store Info */}
          <Card title="🏪 Información del comercio">
            <form onSubmit={handleSaveInfo} className="space-y-4">
              <Input label="Nombre" value={editName} onChange={(e) => setEditName(e.currentTarget.value)} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Descripción (opcional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.currentTarget.value)}
                  rows={2}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    placeholder:text-[var(--text-quaternary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150"
                />
              </div>
              <Input label="Dirección" value={editAddress} onChange={(e) => setEditAddress(e.currentTarget.value)} />
              <Input label="Teléfono (opcional)" value={editPhone} onChange={(e) => setEditPhone(e.currentTarget.value)} />
              <Input label="Especialidad" value={editSpecialty} onChange={(e) => setEditSpecialty(e.currentTarget.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Latitud (opcional)" type="number" step="any" placeholder="-34.6037"
                  value={editLatitude} onChange={(e) => setEditLatitude(e.currentTarget.value)} />
                <Input label="Longitud (opcional)" type="number" step="any" placeholder="-58.3816"
                  value={editLongitude} onChange={(e) => setEditLongitude(e.currentTarget.value)} />
              </div>
              <Button type="submit" loading={saving === "info"}>Guardar información</Button>
            </form>
          </Card>

          {/* Business Hours */}
          <Card title="🕐 Horarios">
            <div className="space-y-2">
              {hours.map((h, i) => (
                <div key={h.dayOfWeek} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium text-[var(--text-secondary)]">
                    {DAY_LABELS[h.dayOfWeek]}
                  </span>
                  <input
                    type="time"
                    value={h.openTime}
                    onChange={(e) => {
                      const next = [...hours]
                      next[i] = { ...next[i], openTime: e.target.value }
                      setHours(next)
                    }}
                    className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-2 py-1.5 text-sm
                      bg-[var(--bg-surface)] text-[var(--text-primary)]
                      hover:border-[var(--border-strong)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                      transition-all duration-150"
                  />
                  <span className="text-xs text-[var(--text-tertiary)]">a</span>
                  <input
                    type="time"
                    value={h.closeTime}
                    onChange={(e) => {
                      const next = [...hours]
                      next[i] = { ...next[i], closeTime: e.target.value }
                      setHours(next)
                    }}
                    className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-2 py-1.5 text-sm
                      bg-[var(--bg-surface)] text-[var(--text-primary)]
                      hover:border-[var(--border-strong)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                      transition-all duration-150"
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSaveHours} loading={saving === "hours"} className="mt-4" variant="secondary">
              Guardar horarios
            </Button>
          </Card>

          {/* Slot Settings */}
          <Card title="⚙️ Configuración de turnos">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Duración del turno (minutos)
                </label>
                <input type="number" min={15} step={15} value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Reservas simultáneas
                </label>
                <input type="number" min={1} value={maxParallelBookings}
                  onChange={(e) => setMaxParallelBookings(Number(e.target.value))}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Límite de turnos por día (0 = sin límite)
                </label>
                <input type="number" min={0} value={maxSlotsPerDay}
                  onChange={(e) => setMaxSlotsPerDay(Number(e.target.value))}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                  Límite de cancelación (horas)
                </label>
                <input type="number" min={0} value={cancelationLimit}
                  onChange={(e) => setCancelationLimit(Number(e.target.value))}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150" />
              </div>
            </div>
            <Button onClick={handleSaveSlots} loading={saving === "slots"} className="mt-4" variant="secondary">
              Guardar configuración
            </Button>
          </Card>

          {/* Blocked Dates */}
          <Card title="🚫 Fechas bloqueadas">
            <div className="flex flex-wrap gap-3 mb-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Fecha</label>
                <input type="date" value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Motivo (opcional)</label>
                <input type="text" placeholder="Ej.: feriado" value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                  className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                    bg-[var(--bg-surface)] text-[var(--text-primary)]
                    placeholder:text-[var(--text-quaternary)]
                    hover:border-[var(--border-strong)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]
                    transition-all duration-150" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddBlockedDate} loading={saving === "blocked"} disabled={!newBlockedDate} size="sm">
                  Agregar
                </Button>
              </div>
            </div>

            {store.blockedDates.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">No hay fechas bloqueadas</p>
            ) : (
              <ul className="space-y-1.5">
                {store.blockedDates.map((bd) => (
                  <li key={bd.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2"
                  >
                    <span className="text-sm text-[var(--text-primary)]">
                      {new Date(bd.date + "T00:00:00").toLocaleDateString("es-AR")}
                      {bd.reason && (
                        <span className="ml-2 text-xs text-[var(--text-tertiary)]">— {bd.reason}</span>
                      )}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveBlockedDate(bd.id)}
                      loading={saving === "blocked"}
                      className="text-[var(--danger)]">
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Appointment Sections */}
          <PendingQueue key={`pending-${appointmentRefreshKey}`} storeId={store.id} />
          <TodayAgenda key={`agenda-${appointmentRefreshKey}`} storeId={store.id}
            onSelectAppointment={setSelectedAppointment} />
          <DayCalendar key={`calendar-${appointmentRefreshKey}`} storeId={store.id} store={store} />

          {/* Appointment Detail Modal */}
          <AppointmentDetail
            appointment={selectedAppointment}
            storeId={store.id}
            onClose={() => setSelectedAppointment(null)}
            onStatusChanged={() => {
              setSelectedAppointment(null)
              setAppointmentRefreshKey((k) => k + 1)
            }}
          />
        </>
      )}
    </div>
  )
}
