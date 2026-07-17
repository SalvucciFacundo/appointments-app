"use client"

import { useEffect, useState, useCallback, type FormEvent } from "react"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import { useToast } from "@/components/ui/Toast"
import {
  getUserStores,
  getStoreById,
  updateStore,
  updateHours,
  addBlockedDate,
  removeBlockedDate,
  type StoreData,
  type BusinessHourInput,
  type ApiError,
} from "@/lib/stores"
import type { AppointmentData } from "@/lib/appointments"
import TodayAgenda from "@/components/appointments/TodayAgenda"
import PendingQueue from "@/components/appointments/PendingQueue"
import DayCalendar from "@/components/appointments/DayCalendar"
import AppointmentDetail from "@/components/appointments/AppointmentDetail"
import { StatusBarChart } from "@/components/charts/AppointmentChart"
import {
  getCalendarStatus,
  enableCalendar,
  disableCalendar,
} from "@/lib/calendar-client"

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function sumTotal(total: Record<string, number>): number {
  return Object.values(total).reduce((s, v) => s + v, 0)
}

function formatPeakHour(hour: number | null): string {
  if (hour === null) return "—"
  return `${hour}:00`
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-center shadow-[var(--shadow-sm)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{sub}</p>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 skeleton" />
      <div className="h-4 w-full skeleton" />
      <div className="h-4 w-3/4 skeleton" />
    </div>
  )
}

export default function DashboardPage() {
  const { addToast } = useToast()

  const [stores, setStores] = useState<StoreData[]>([])
  const [store, setStore] = useState<StoreData | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [storesLoading, setStoresLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

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
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null)
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0)

  // Analytics
  const [stats, setStats] = useState<{
    total: Record<string, number>
    attendanceRate: number
    peakHour: number | null
    peakHourCount: number
    repeatCustomers: number
    todayCount: number
  } | null>(null)

  // Calendar sync
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)

  const loadCalendarStatus = useCallback(async (storeId: string) => {
    try {
      const data = await getCalendarStatus(storeId)
      setCalendarEnabled(data.enabled)
      setCalendarError(data.lastSyncError ?? null)
    } catch {
      // Calendar not configured — stay disabled
    }
  }, [])

  const loadStats = useCallback(async (storeId: string) => {
    try {
      const res = await fetch(`/api/stores/${storeId}/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // Stats not critical — silently fail
    }
  }, [])

  const showMessage = (type: "success" | "error", text: string) => {
    addToast(text, type)
  }

  // Load all user stores
  const loadStores = useCallback(async () => {
    setStoresLoading(true)
    try {
      const data = await getUserStores()
      setStores(data)
      if (data.length > 0 && !selectedStoreId) {
        setSelectedStoreId(data[0].id)
      }
    } catch {
      // Silently fail — onboarding redirect handles empty state
    } finally {
      setStoresLoading(false)
    }
  }, [selectedStoreId])

  // Load specific store data
  const loadStoreById = useCallback(async (storeId: string) => {
    setLoading(true)
    try {
      const data = await getStoreById(storeId)
      if (data) {
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

        if (data.businessHours && data.businessHours.length > 0) {
          setHours(
            DAY_LABELS.map((_, i) => {
              const existing = data.businessHours.find((h: BusinessHourInput) => h.dayOfWeek === i)
              return existing
                ? { dayOfWeek: i, openTime: existing.openTime, closeTime: existing.closeTime }
                : { dayOfWeek: i, openTime: "09:00", closeTime: "18:00" }
            }),
          )
        }

        loadCalendarStatus(data.id)
        loadStats(data.id)
      }
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to load store")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load: stores list
  useEffect(() => {
    loadStores()
  }, [loadStores])

  // When selectedStoreId changes, load that store
  useEffect(() => {
    if (selectedStoreId) {
      loadStoreById(selectedStoreId)
    }
  }, [selectedStoreId, loadStoreById])

  // ---- Save Handlers ----

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault()
    if (!store) return

    setSaving("info")
    try {
      const updated = await updateStore(store.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        address: editAddress.trim(),
        phone: editPhone.trim() || undefined,
        specialty: editSpecialty.trim(),
        latitude: editLatitude ? parseFloat(editLatitude) : undefined,
        longitude: editLongitude ? parseFloat(editLongitude) : undefined,
      })
      setStore((prev) => (prev ? { ...prev, ...updated } : prev))
      showMessage("success", "Store info updated")
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to update")
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveHours() {
    if (!store) return

    setSaving("hours")
    try {
      await updateHours(store.id, hours)
      showMessage("success", "Business hours updated")
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to update hours")
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveSlots() {
    if (!store) return

    setSaving("slots")
    try {
      const updated = await updateStore(store.id, {
        slotDuration,
        maxParallelBookings,
        maxSlotsPerDay,
        cancelationLimit,
      })
      setStore((prev) => (prev ? { ...prev, ...updated } : prev))
      showMessage("success", "Slot settings updated")
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to update settings")
    } finally {
      setSaving(null)
    }
  }

  async function handleAddBlockedDate() {
    if (!store || !newBlockedDate) return

    setSaving("blocked")
    try {
      const bd = await addBlockedDate(store.id, newBlockedDate, newBlockedReason || undefined)
      setStore((prev) =>
        prev
          ? {
              ...prev,
              blockedDates: [
                ...prev.blockedDates,
                { id: bd.id, date: bd.date, reason: bd.reason },
              ],
            }
          : prev,
      )
      setNewBlockedDate("")
      setNewBlockedReason("")
      showMessage("success", "Blocked date added")
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to add blocked date")
    } finally {
      setSaving(null)
    }
  }

  async function handleRemoveBlockedDate(blockedDateId: string) {
    if (!store) return

    setSaving("blocked")
    try {
      await removeBlockedDate(store.id, blockedDateId)
      setStore((prev) =>
        prev
          ? {
              ...prev,
              blockedDates: prev.blockedDates.filter((bd) => bd.id !== blockedDateId),
            }
          : prev,
      )
      showMessage("success", "Blocked date removed")
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to remove blocked date")
    } finally {
      setSaving(null)
    }
  }

  // ---- Calendar Handlers ----

  async function handleConnectCalendar() {
    if (!store) return
    setCalendarLoading(true)
    try {
      const { url } = await enableCalendar(store.id)
      window.location.href = url
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to connect calendar")
      setCalendarLoading(false)
    }
  }

  async function handleDisconnectCalendar() {
    if (!store) return
    setCalendarLoading(true)
    try {
      await disableCalendar(store.id)
      setCalendarEnabled(false)
      showMessage("success", "Google Calendar disconnected")
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to disconnect calendar")
    } finally {
      setCalendarLoading(false)
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <Skeleton />
        </Card>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <p className="text-sm text-[var(--text-tertiary)]">
            No store found. Please complete onboarding.
          </p>
        </Card>
      </div>
    )
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 animate-fadeIn">
      {/* Header with store selector */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
        <div className="flex items-center gap-2">
          {stores.length > 1 && (
            <select
              value={selectedStoreId ?? ""}
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
          {stores.length > 1 && store && (
            <span className="text-xs text-[var(--text-tertiary)]">{store.name}</span>
          )}
        </div>
        <a
          href="/onboarding"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium
            text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
            transition-all duration-150"
        >
          <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5v14" />
          </svg>
          Nuevo
        </a>
      </div>

      {/* Analytics */}
      {stats && (
        <Card title="📊 Analytics">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <StatCard label="Today" value={stats.todayCount} />
            <StatCard label="Total" value={sumTotal(stats.total)} />
            <StatCard label="Completed" value={stats.total["COMPLETED"] ?? 0} />
            <StatCard label="Cancelled" value={stats.total["CANCELLED"] ?? 0} />
            <StatCard label="Attendance" value={`${stats.attendanceRate}%`} />
            <StatCard label="Peak Hour" value={formatPeakHour(stats.peakHour)} sub={stats.peakHourCount > 0 ? `${stats.peakHourCount} appts` : undefined} />
          </div>
          {stats.repeatCustomers > 0 && (
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
              {stats.repeatCustomers} repeat customer{stats.repeatCustomers !== 1 ? "s" : ""}
            </p>
          )}
          <div className="mt-4">
            <StatusBarChart stats={stats} />
          </div>
        </Card>
      )}

      {/* Store Info */}
      <Card title="🏪 Store Information">
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.currentTarget.value)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Description (optional)
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.currentTarget.value)}
              rows={2}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150"
            />
          </div>
          <Input label="Address" value={editAddress} onChange={(e) => setEditAddress(e.currentTarget.value)} />
          <Input label="Phone (optional)" value={editPhone} onChange={(e) => setEditPhone(e.currentTarget.value)} />
          <Input label="Specialty" value={editSpecialty} onChange={(e) => setEditSpecialty(e.currentTarget.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Latitude (optional)" type="number" step="any" placeholder="-34.6037"
              value={editLatitude} onChange={(e) => setEditLatitude(e.currentTarget.value)} />
            <Input label="Longitude (optional)" type="number" step="any" placeholder="-58.3816"
              value={editLongitude} onChange={(e) => setEditLongitude(e.currentTarget.value)} />
          </div>
          {editLatitude && editLongitude && (
            <a href={`https://www.google.com/maps?q=${editLatitude},${editLongitude}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
            >
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              View on Google Maps
            </a>
          )}
          <Button type="submit" loading={saving === "info"}>Save Info</Button>
        </form>
      </Card>

      {/* Business Hours */}
      <Card title="🕐 Business Hours">
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
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                  transition-all duration-150"
              />
              <span className="text-xs text-[var(--text-tertiary)]">to</span>
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
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                  transition-all duration-150"
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSaveHours} loading={saving === "hours"} className="mt-4" variant="secondary">
          Save Hours
        </Button>
      </Card>

      {/* Slot Settings */}
      <Card title="⚙️ Slot Settings">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Slot Duration (minutes)
            </label>
            <input type="number" min={15} step={15} value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Max Parallel Bookings</label>
            <input type="number" min={1} value={maxParallelBookings}
              onChange={(e) => setMaxParallelBookings(Number(e.target.value))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Max Slots Per Day</label>
            <input type="number" min={0} value={maxSlotsPerDay}
              onChange={(e) => setMaxSlotsPerDay(Number(e.target.value))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cancellation Limit (hours)</label>
            <input type="number" min={0} value={cancelationLimit}
              onChange={(e) => setCancelationLimit(Number(e.target.value))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150" />
          </div>
        </div>
        <Button onClick={handleSaveSlots} loading={saving === "slots"} className="mt-4" variant="secondary">
          Save Settings
        </Button>
      </Card>

      {/* Blocked Dates */}
      <Card title="🚫 Blocked Dates">
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Date</label>
            <input type="date" value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Reason (optional)</label>
            <input type="text" placeholder="e.g. Holiday" value={newBlockedReason}
              onChange={(e) => setNewBlockedReason(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleAddBlockedDate} loading={saving === "blocked"} disabled={!newBlockedDate} size="sm">
              Add
            </Button>
          </div>
        </div>

        {store.blockedDates.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">No blocked dates</p>
        ) : (
          <ul className="space-y-1.5">
            {store.blockedDates.map((bd) => (
              <li key={bd.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2"
              >
                <span className="text-sm text-[var(--text-primary)]">
                  {new Date(bd.date).toLocaleDateString("es-AR")}
                  {bd.reason && (
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">— {bd.reason}</span>
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveBlockedDate(bd.id)}
                  loading={saving === "blocked"}
                  className="text-[var(--danger)] hover:text-[var(--danger-hover)]">
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Calendar Sync */}
      <Card title="📅 Google Calendar Sync">
        {calendarError && (
          <div className="mb-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--danger)]">⚠ Sync error</p>
            <p className="mt-1 text-xs text-[var(--danger)] opacity-80">{calendarError}</p>
          </div>
        )}

        {calendarEnabled ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-[var(--success-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
                Connected
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                Appointments are synced to Google Calendar
              </span>
            </div>
            <Button variant="danger" size="sm" onClick={handleDisconnectCalendar} loading={calendarLoading}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-tertiary)]">
                Not connected
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                Connect to sync appointments automatically
              </span>
            </div>
            <Button size="sm" onClick={handleConnectCalendar} loading={calendarLoading}>
              Connect Google Calendar
            </Button>
          </div>
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
    </div>
  )
}
