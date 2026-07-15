import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"
import { getAvailableSlots, type SlotStoreInput } from "@/lib/slots"

interface RouteParams {
  params: Promise<{ storeId: string; id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { storeId, id } = await params

  try {
    const { store } = await assertOwnerAccess(storeId)

    const body = await request.json().catch(() => ({}))
    const { dateTime } = body as { dateTime?: string }

    // Validate input
    if (!dateTime || typeof dateTime !== "string") {
      return Response.json(
        {
          error: "Validation failed",
          errors: [{ field: "dateTime", message: "dateTime is required (ISO string)" }],
        },
        { status: 400 },
      )
    }

    const newDate = new Date(dateTime)
    if (isNaN(newDate.getTime())) {
      return Response.json(
        {
          error: "Validation failed",
          errors: [{ field: "dateTime", message: "Invalid dateTime format" }],
        },
        { status: 400 },
      )
    }

    // Fetch the appointment to reschedule
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment || appointment.storeId !== storeId) {
      return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Fetch full store config for slot validation
    const storeWithConfig = await prisma.store.findUnique({
      where: { id: storeId },
      include: { businessHours: true, blockedDates: true },
    })

    if (!storeWithConfig) {
      return Response.json({ error: "Store not found" }, { status: 404 })
    }

    // Determine local date from the new dateTime
    const localDate = (() => {
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: storeWithConfig.timezone }).format(newDate)
      } catch {
        return newDate.toISOString().slice(0, 10)
      }
    })()

    // Fetch all existing appointments for that date (excluding the one being rescheduled)
    const existing = await prisma.appointment.findMany({
      where: {
        storeId,
        id: { not: id },
      },
      select: { dateTime: true },
    })

    // Validate slot availability via pure function
    const slotInput: SlotStoreInput = {
      businessHours: storeWithConfig.businessHours,
      blockedDates: storeWithConfig.blockedDates.map((bd) => ({ date: bd.date })),
      slotDuration: storeWithConfig.slotDuration,
      maxParallelBookings: storeWithConfig.maxParallelBookings,
      maxSlotsPerDay: storeWithConfig.maxSlotsPerDay,
      timezone: storeWithConfig.timezone,
    }

    const slots = getAvailableSlots(slotInput, localDate, existing)

    // Check specific validation errors
    const hasBusinessHours = storeWithConfig.businessHours.some(
      (h) => h.dayOfWeek === new Date(localDate + "T00:00:00").getDay(),
    )

    if (!hasBusinessHours) {
      return Response.json(
        {
          error: "Outside business hours",
          errors: [{ field: "dateTime", message: "No business hours for this day" }],
        },
        { status: 400 },
      )
    }

    const isBlocked = storeWithConfig.blockedDates.some((bd) => {
      try {
        const bdLocal = new Intl.DateTimeFormat("en-CA", { timeZone: storeWithConfig.timezone }).format(bd.date)
        return bdLocal === localDate
      } catch {
        return bd.date.toISOString().slice(0, 10) === localDate
      }
    })

    if (isBlocked) {
      return Response.json(
        {
          error: "Date is blocked",
          errors: [{ field: "dateTime", message: "This date is blocked" }],
        },
        { status: 400 },
      )
    }

    // Check if the new time fits in an available slot
    const localTime = (() => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: storeWithConfig.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(newDate)
        const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
        const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
        return `${hour}:${minute}`
      } catch {
        return newDate.toISOString().slice(11, 16)
      }
    })()

    const matchingSlot = slots.find(
      (s) => localTime >= s.start && localTime < s.end,
    )

    if (!matchingSlot) {
      // Time is outside all slots — must be outside business hours
      return Response.json(
        {
          error: "Outside business hours",
          errors: [{ field: "dateTime", message: "Time is outside business hours" }],
        },
        { status: 400 },
      )
    }

    if (!matchingSlot.available) {
      return Response.json(
        {
          error: "Slot capacity exceeded",
          errors: [{ field: "dateTime", message: "This time slot is at full capacity" }],
        },
        { status: 400 },
      )
    }

    // All checks passed — update the appointment
    const updated = await prisma.appointment.update({
      where: { id },
      data: { dateTime: newDate },
    })

    return Response.json({
      id: updated.id,
      storeId: updated.storeId,
      clientName: updated.clientName,
      clientPhone: updated.clientPhone,
      clientEmail: updated.clientEmail,
      dateTime: updated.dateTime.toISOString(),
      service: updated.service,
      status: updated.status,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
