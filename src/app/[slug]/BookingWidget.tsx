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
      <BookingForm slug={slug} selectedSlot={selectedSlot} />
    </div>
  )
}
