import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"
import type { AppointmentStatus } from "@prisma/client"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

function getDateRangeForTimeZone(date: string, timezone: string): { gte: Date; lt: Date } {
  // We query a wide UTC window (date - 1 day → date + 2 days) and filter in JS.
  // This avoids complex offset calculations for DST-aware timezones.
  const center = new Date(date + "T00:00:00.000Z")
  const gte = new Date(center)
  gte.setUTCDate(gte.getUTCDate() - 1)
  const lt = new Date(center)
  lt.setUTCDate(lt.getUTCDate() + 2)
  return { gte, lt }
}

function localDateFilter(date: Date, targetDate: string, timezone: string): boolean {
  try {
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date)
    return local === targetDate
  } catch {
    return date.toISOString().slice(0, 10) === targetDate
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    const { store } = await assertOwnerAccess(storeId)
    const url = new URL(request.url)
    const dateFilter = url.searchParams.get("date")
    const statusFilter = url.searchParams.get("status")

    const where: Record<string, unknown> = { storeId }

    if (dateFilter) {
      const range = getDateRangeForTimeZone(dateFilter, store.timezone)
      where.dateTime = { gte: range.gte, lt: range.lt }
    }

    if (statusFilter) {
      const allowed = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]
      if (!allowed.includes(statusFilter.toUpperCase())) {
        return Response.json(
          { error: "Invalid status filter", errors: [{ field: "status", message: "Must be one of: " + allowed.join(", ") }] },
          { status: 400 },
        )
      }
      where.status = statusFilter.toUpperCase()
    }

    let appointments = await prisma.appointment.findMany({
      where,
      orderBy: { dateTime: "asc" },
    })

    // Post-filter by local date when timezone-aware filtering is needed
    if (dateFilter) {
      appointments = appointments.filter((apt) =>
        localDateFilter(apt.dateTime, dateFilter, store.timezone),
      )
    }

    // Map to the desired response shape
    const result = appointments.map((apt) => ({
      id: apt.id,
      storeId: apt.storeId,
      clientName: apt.clientName,
      clientPhone: apt.clientPhone,
      clientEmail: apt.clientEmail,
      dateTime: apt.dateTime.toISOString(),
      service: apt.service,
      status: apt.status,
      notes: apt.notes,
      createdAt: apt.createdAt.toISOString(),
      updatedAt: apt.updatedAt.toISOString(),
    }))

    return Response.json(result)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)
    const body = await request.json().catch(() => ({}))

    const { clientName, clientPhone, clientEmail, dateTime, service, notes, status } =
      body as {
        clientName?: string
        clientPhone?: string
        clientEmail?: string
        dateTime?: string
        service?: string
        notes?: string
        status?: string
      }

    // Validation
    const errors: { field: string; message: string }[] = []
    if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
      errors.push({ field: "clientName", message: "clientName is required" })
    }
    if (!clientPhone || typeof clientPhone !== "string" || !clientPhone.trim()) {
      errors.push({ field: "clientPhone", message: "clientPhone is required" })
    }
    if (!clientEmail || typeof clientEmail !== "string" || !clientEmail.trim()) {
      errors.push({ field: "clientEmail", message: "clientEmail is required" })
    }
    if (!dateTime || typeof dateTime !== "string") {
      errors.push({ field: "dateTime", message: "dateTime is required" })
    } else {
      const parsed = new Date(dateTime)
      if (isNaN(parsed.getTime())) {
        errors.push({ field: "dateTime", message: "Invalid dateTime format" })
      }
    }

    if (status) {
      const allowed = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]
      if (!allowed.includes(status.toUpperCase())) {
        errors.push({ field: "status", message: "Invalid status" })
      }
    }

    if (errors.length > 0) {
      return Response.json({ error: "Validation failed", errors }, { status: 400 })
    }

    const appointment = await prisma.appointment.create({
      data: {
        storeId,
        clientName: clientName!.trim(),
        clientPhone: clientPhone!.trim(),
        clientEmail: clientEmail!.trim(),
        dateTime: new Date(dateTime!),
        service: typeof service === "string" ? service.trim() || null : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        status: (status?.toUpperCase() as AppointmentStatus) ?? "CONFIRMED",
      },
    })

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
        createdAt: appointment.createdAt.toISOString(),
        updatedAt: appointment.updatedAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
