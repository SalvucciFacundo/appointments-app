"use client"

import { useState, useEffect } from "react"

interface TimeSlot {
  start: string
  end: string
  available: boolean
  currentBookings: number
}

interface SlotCalendarProps {
  slug: string
  onSelectSlot: (slot: { date: string; time: string; endTime: string }) => void
}

const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

export default function SlotCalendar({ slug, onSelectSlot }: SlotCalendarProps) {
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string
    time: string
    endTime: string
  } | null>(null)

  useEffect(() => {
    if (!date) return

    setLoading(true)
    setError(null)
    setSelectedSlot(null)

    fetch(`/api/stores/${slug}/slots?date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load slots")
        return res.json()
      })
      .then((data) => setSlots(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [date, slug])

  const handleSelect = (slot: TimeSlot) => {
    const sel = { date, time: slot.start, endTime: slot.end }
    setSelectedSlot(sel)
    onSelectSlot(sel)
  }

  const dayLabel = date
    ? DAYS_OF_WEEK[new Date(date + "T00:00:00").getDay()]
    : ""

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Seleccioná una fecha
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </label>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cargando horarios...
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && date && slots.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No hay horarios disponibles para el {dayLabel.toLowerCase()} {date}.
        </p>
      )}

      {slots.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {dayLabel} {date}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const isSelected =
                selectedSlot?.time === slot.start &&
                selectedSlot?.date === date

              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => slot.available && handleSelect(slot)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : slot.available
                        ? "border-gray-300 bg-white text-gray-900 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-blue-400"
                        : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600"
                  }`}
                >
                  {slot.start}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
