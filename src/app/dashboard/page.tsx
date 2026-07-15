"use client"

import { useEffect, useState, useCallback, type FormEvent } from "react"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import {
  getCurrentStore,
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
import {
  getCalendarStatus,
  enableCalendar,
  disableCalendar,
} from "@/lib/calendar-client"

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

export default function DashboardPage() {
  const [store, setStore] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Editable fields
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editSpecialty, setEditSpecialty] = useState("")

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

  // Calendar sync
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)

  const loadCalendarStatus = useCallback(async (storeId: string) => {
    try {
      const { enabled } = await getCalendarStatus(storeId)
      setCalendarEnabled(enabled)
    } catch {
      // Calendar not configured — stay disabled
    }
  }, [])

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const loadStore = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCurrentStore()
      if (data) {
        setStore(data)
        setEditName(data.name)
        setEditDescription(data.description ?? "")
        setEditAddress(data.address)
        setEditPhone(data.phone ?? "")
        setEditSpecialty(data.specialty)
        setSlotDuration(data.slotDuration)
        setMaxParallelBookings(data.maxParallelBookings)
        setMaxSlotsPerDay(data.maxSlotsPerDay)
        setCancelationLimit(data.cancelationLimit)

        if (data.businessHours && data.businessHours.length > 0) {
          setHours(
            DAY_LABELS.map((_, i) => {
              const existing = data.businessHours.find((h) => h.dayOfWeek === i)
              return existing
                ? { dayOfWeek: i, openTime: existing.openTime, closeTime: existing.closeTime }
                : { dayOfWeek: i, openTime: "09:00", closeTime: "18:00" }
            }),
          )
        }

        loadCalendarStatus(data.id)
      }
    } catch (err) {
      const apiErr = err as ApiError
      showMessage("error", apiErr?.error ?? "Failed to load store")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStore()
  }, [loadStore])

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
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <Skeleton />
        </Card>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            No store found. Please complete onboarding.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Store Info */}
      <Card title="Store Information">
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.currentTarget.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.currentTarget.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                dark:border-gray-600"
            />
          </div>
          <Input
            label="Address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.currentTarget.value)}
          />
          <Input
            label="Phone (optional)"
            value={editPhone}
            onChange={(e) => setEditPhone(e.currentTarget.value)}
          />
          <Input
            label="Specialty"
            value={editSpecialty}
            onChange={(e) => setEditSpecialty(e.currentTarget.value)}
          />
          <Button type="submit" loading={saving === "info"}>
            Save Info
          </Button>
        </form>
      </Card>

      {/* Business Hours */}
      <Card title="Business Hours">
        <div className="space-y-3">
          {hours.map((h, i) => (
            <div key={h.dayOfWeek} className="flex items-center gap-3">
              <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300">
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
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="time"
                value={h.closeTime}
                onChange={(e) => {
                  const next = [...hours]
                  next[i] = { ...next[i], closeTime: e.target.value }
                  setHours(next)
                }}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm
                  dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSaveHours} loading={saving === "hours"} className="mt-4">
          Save Hours
        </Button>
      </Card>

      {/* Slot Settings */}
      <Card title="Slot Settings">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Slot Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              step={15}
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Parallel Bookings
            </label>
            <input
              type="number"
              min={1}
              value={maxParallelBookings}
              onChange={(e) => setMaxParallelBookings(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Slots Per Day
            </label>
            <input
              type="number"
              min={0}
              value={maxSlotsPerDay}
              onChange={(e) => setMaxSlotsPerDay(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cancellation Limit (hours)
            </label>
            <input
              type="number"
              min={0}
              value={cancelationLimit}
              onChange={(e) => setCancelationLimit(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>
        <Button onClick={handleSaveSlots} loading={saving === "slots"} className="mt-4">
          Save Settings
        </Button>
      </Card>

      {/* Blocked Dates */}
      <Card title="Blocked Dates">
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Holiday"
              value={newBlockedReason}
              onChange={(e) => setNewBlockedReason(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAddBlockedDate}
              loading={saving === "blocked"}
              disabled={!newBlockedDate}
            >
              Add
            </Button>
          </div>
        </div>

        {store.blockedDates.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No blocked dates</p>
        ) : (
          <ul className="space-y-2">
            {store.blockedDates.map((bd) => (
              <li
                key={bd.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-2
                  dark:border-gray-700"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(bd.date).toLocaleDateString("es-AR")}
                  {bd.reason && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400">— {bd.reason}</span>
                  )}
                </span>
                <Button
                  variant="danger"
                  onClick={() => handleRemoveBlockedDate(bd.id)}
                  loading={saving === "blocked"}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Calendar Sync */}
      <Card title="Google Calendar Sync">
        {calendarEnabled ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Connected
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Appointments are synced to Google Calendar
              </span>
            </div>
            <Button
              variant="danger"
              onClick={handleDisconnectCalendar}
              loading={calendarLoading}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Not connected
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Connect to sync appointments automatically
              </span>
            </div>
            <Button
              onClick={handleConnectCalendar}
              loading={calendarLoading}
            >
              Connect Google Calendar
            </Button>
          </div>
        )}
      </Card>

      {/* ---- Appointment Sections ---- */}
      <PendingQueue key={`pending-${appointmentRefreshKey}`} storeId={store.id} />

      <TodayAgenda
        key={`agenda-${appointmentRefreshKey}`}
        storeId={store.id}
        onSelectAppointment={setSelectedAppointment}
      />

      <DayCalendar
        key={`calendar-${appointmentRefreshKey}`}
        storeId={store.id}
        store={store}
      />

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
