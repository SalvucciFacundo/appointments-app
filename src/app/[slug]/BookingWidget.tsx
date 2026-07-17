"use client"

import { useState } from "react"
import SlotCalendar from "@/app/[slug]/SlotCalendar"
import BookingForm from "@/app/[slug]/BookingForm"

interface SelectedSlot {
  date: string
  time: string
  endTime: string
}

interface BookingWidgetProps {
  slug: string
}

export default function BookingWidget({ slug }: BookingWidgetProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)

  return (
    <div className="space-y-6">
      <SlotCalendar slug={slug} onSelectSlot={setSelectedSlot} />
      {selectedSlot && (
        <div className="animate-slideUp">
          <div className="mb-3 rounded-[var(--radius-lg)] border border-[var(--accent-border)] bg-[var(--accent-light)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--accent)]">
              Turno seleccionado: {selectedSlot.date} de {selectedSlot.time} a{" "}
              {selectedSlot.endTime}
            </p>
          </div>
          <BookingForm slug={slug} selectedSlot={selectedSlot} />
        </div>
      )}
    </div>
  )
}
