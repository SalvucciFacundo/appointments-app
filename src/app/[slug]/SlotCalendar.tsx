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

const DAYS_OF_WEEK = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

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
        if (!res.ok) throw new Error("Error al cargar horarios")
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

  const today = new Date()
  const dayLabel = date ? DAYS_OF_WEEK[new Date(date + "T12:00:00").getDay()] : ""
  const dateObj = date ? new Date(date + "T12:00:00") : null
  const formattedDate = dateObj
    ? `${dateObj.getDate()} de ${MONTHS[dateObj.getMonth()]}`
    : ""

  // Group slots by time period
  const morningSlots = slots.filter((s) => parseInt(s.start) < 12)
  const afternoonSlots = slots.filter((s) => parseInt(s.start) >= 12 && parseInt(s.start) < 18)
  const eveningSlots = slots.filter((s) => parseInt(s.start) >= 18)

  const renderSlotGrid = (slotList: TimeSlot[], periodLabel: string) => {
    if (slotList.length === 0) return null
    return (
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {periodLabel}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slotList.map((slot) => {
            const isSelected =
              selectedSlot?.time === slot.start && selectedSlot?.date === date

            return (
              <button
                key={slot.start}
                type="button"
                disabled={!slot.available}
                onClick={() => slot.available && handleSelect(slot)}
                className={`relative rounded-[var(--radius-md)] border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isSelected
                    ? "border-[var(--accent)] bg-gradient-to-r from-[var(--accent)] to-emerald-600 text-white shadow-md shadow-emerald-500/20 scale-105"
                    : slot.available
                      ? "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:shadow-sm hover:-translate-y-0.5"
                      : "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-quaternary)]"
                }`}
              >
                {slot.start}
                {/* Availability indicator */}
                {slot.available && !isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--success)] shadow-sm shadow-green-500/30" />
                )}
                {!slot.available && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--danger)] opacity-50" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)] pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={today.toISOString().slice(0, 10)}
            className="w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-2.5 pl-10 pr-3 text-sm
              text-[var(--text-primary)]
              hover:border-[var(--border-strong)]
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
              transition-all duration-150"
          />
        </div>

        {date && (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-[var(--text-primary)]">
              {dayLabel} {formattedDate}
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Disponible
              <span className="ml-2 h-2 w-2 rounded-full bg-[var(--danger)] opacity-50" /> Ocupado
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <div className="h-4 w-24 skeleton" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 skeleton rounded-[var(--radius-md)]" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-md)] bg-[var(--danger-light)] px-4 py-3">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {/* No slots */}
      {!loading && !error && date && slots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--bg-muted)]">
            <svg className="h-6 w-6 text-[var(--text-tertiary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">
            No hay horarios disponibles para {dayLabel.toLowerCase()} {formattedDate}.
          </p>
        </div>
      )}

      {/* Slot grids by period */}
      {!loading && slots.length > 0 && (
        <div className="animate-fadeIn">
          {renderSlotGrid(morningSlots, "Mañana")}
          {renderSlotGrid(afternoonSlots, "Tarde")}
          {renderSlotGrid(eveningSlots, "Noche")}
        </div>
      )}
    </div>
  )
}
