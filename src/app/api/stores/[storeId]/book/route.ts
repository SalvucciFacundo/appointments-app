import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getAvailableSlots } from "@/lib/slots"
import { generateManagementToken, buildManagementUrl } from "@/lib/management-link"
import { sendConfirmationEmail } from "@/lib/email"
import { createEvent } from "@/lib/calendar/events"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

function getLocalDate(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function getLocalTime(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
    return `${hour}:${minute}`
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { storeId: slug } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { clientName, clientPhone, clientEmail, dateTime, service, notes } = body

  const session = await auth().catch(() => null)

  // Validation
  const errors: { field: string; message: string }[] = []

  if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
    errors.push({ field: "clientName", message: "Name is required" })
  }
  if (!clientPhone || typeof clientPhone !== "string" || !clientPhone.trim()) {
    errors.push({ field: "clientPhone", message: "Phone is required" })
  }
  if (!clientEmail || typeof clientEmail !== "string" || !clientEmail.trim()) {
    errors.push({ field: "clientEmail", message: "Email is required" })
  }
  if (!dateTime || typeof dateTime !== "string") {
    errors.push({ field: "dateTime", message: "dateTime is required" })
  } else {
    const parsed = new Date(dateTime as string)
    if (isNaN(parsed.getTime())) {
      errors.push({ field: "dateTime", message: "Invalid dateTime format" })
    }
  }

  if (errors.length > 0) {
    return Response.json({ error: "Validation failed", errors }, { status: 400 })
  }

  // Look up store by slug
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      blockedDates: true,
      calendarSync: true,
    },
  })

  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 })
  }

  // Validate slot availability in the store's timezone
  const dt = new Date(dateTime as string)
  const localDate = getLocalDate(dt, store.timezone)
  const localTime = getLocalTime(dt, store.timezone)

  const appointments = await prisma.appointment.findMany({
    where: { storeId: store.id },
    select: { dateTime: true },
  })

  const slots = getAvailableSlots(
    {
      businessHours: store.businessHours,
      blockedDates: store.blockedDates.map((bd) => ({
        date: bd.date.toISOString().slice(0, 10),
      })),
      slotDuration: store.slotDuration,
      maxParallelBookings: store.maxParallelBookings,
      maxSlotsPerDay: store.maxSlotsPerDay,
      timezone: store.timezone,
    },
    localDate,
    appointments,
  )

  const matchingSlot = slots.find((s) => s.start === localTime && s.available)

  if (!matchingSlot) {
    return Response.json(
      { error: "The selected time slot is not available" },
      { status: 409 },
    )
  }

  // Create appointment
  const isAuthenticated = session?.user?.id != null
  const managementToken = generateManagementToken()

  const appointment = await prisma.appointment.create({
    data: {
      storeId: store.id,
      clientName: (clientName as string).trim(),
      clientPhone: (clientPhone as string).trim(),
      clientEmail: (clientEmail as string).trim(),
      dateTime: dt,
      service: typeof service === "string" ? service.trim() || null : null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      userId: isAuthenticated ? session!.user!.id : null,
      status: isAuthenticated ? "CONFIRMED" : "PENDING",
      managementToken,
    },
  })

  // Fire-and-forget confirmation email
  const managementUrl = isAuthenticated
    ? undefined
    : buildManagementUrl(managementToken)

  sendConfirmationEmail({
    to: appointment.clientEmail,
    clientName: appointment.clientName,
    storeName: store.name,
    dateTime: appointment.dateTime,
    service: appointment.service,
    managementUrl,
  }).catch((err) => {
    console.error("[book] Failed to send confirmation email:", err)
  })

  // Fire-and-forget Google Calendar event creation
  if (store.calendarSync) {
    createEvent(
      store.calendarSync,
      {
        id: appointment.id,
        clientName: appointment.clientName,
        clientEmail: appointment.clientEmail,
        dateTime: appointment.dateTime,
        service: appointment.service,
        notes: appointment.notes,
      },
      { name: store.name, timezone: store.timezone },
    )
      .then((googleEventId) => {
        if (googleEventId) {
          return prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId },
          })
        }
      })
      .catch((err) => {
        console.error("[book] Failed to sync calendar event:", err)
      })
  }

  return Response.json(
    {
      id: appointment.id,
      storeId: appointment.storeId,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      clientEmail: appointment.clientEmail,
      dateTime: appointment.dateTime.toISOString(),
      service: appointment.service,
      status: appointment.status,
      notes: appointment.notes,
    },
    { status: 201 },
  )
}
